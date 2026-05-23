import { NextRequest, NextResponse } from "next/server";
import {
  createSource,
  getObjective,
  updateSourceSemiontId,
} from "@/lib/repository";
import { getDb } from "@/lib/db";
import { syncSourceToSemiont } from "@/lib/semiont/client";
import { recordEvent, withTiming } from "@/lib/observability/events";
import {
  extractPdfBuffer,
  extractTextFile,
  getMaxPdfBytes,
  getMaxPdfPages,
  saveUploadedFile,
} from "@/lib/pdf/extract";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const objective_id = form.get("objective_id")?.toString();
    const file = form.get("file");

    if (!objective_id) {
      return NextResponse.json({ error: "objective_id required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const objective = getObjective(objective_id);
    if (!objective) {
      return NextResponse.json({ error: "objective not found" }, { status: 404 });
    }

    const maxBytes = getMaxPdfBytes();
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name || "document.pdf";
    const lower = name.toLowerCase();

    if (!lower.endsWith(".pdf") && !lower.endsWith(".txt") && !lower.endsWith(".md")) {
      return NextResponse.json(
        { error: "Supported formats: .pdf, .txt, .md" },
        { status: 400 }
      );
    }

    const { result: extraction, latency_ms } = await withTiming(async () => {
      if (lower.endsWith(".pdf")) return extractPdfBuffer(buffer, name);
      return extractTextFile(buffer, name);
    });

    if (extraction.totalPages > getMaxPdfPages()) {
      return NextResponse.json(
        { error: `Too many pages (max ${getMaxPdfPages()})` },
        { status: 400 }
      );
    }

    const source = createSource({
      objective_id,
      url: `upload://${name}`,
      title: extraction.title,
      author: extraction.author,
      source_type: lower.endsWith(".pdf") ? "pdf" : "text",
      text_content: extraction.text,
      semiont_resource_id: null,
      page_offsets: JSON.stringify(extraction.pageOffsets),
      total_pages: extraction.totalPages,
      content_hash: extraction.contentHash,
      byte_size: extraction.byteSize,
      file_path: null,
    });

    const filePath = saveUploadedFile(source.id, name, buffer);
    getDb().prepare("UPDATE sources SET file_path = ? WHERE id = ?").run(filePath, source.id);
    source.file_path = filePath;

    const semiontId = await syncSourceToSemiont(source);
    if (semiontId) updateSourceSemiontId(source.id, semiontId);

    await recordEvent({
      trace_id: objective.trace_id,
      objective_id,
      event_type: "source_uploaded",
      object_type: "source",
      object_id: source.id,
      agent_name: "SourceAgent",
      latency_ms,
      status: "success",
      metadata: {
        filename: name,
        pages: extraction.totalPages,
        semiont_synced: Boolean(semiontId),
      },
    });

    return NextResponse.json(
      {
        objective,
        ...source,
        pages: extraction.pages,
        page_count: extraction.pages.length,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
