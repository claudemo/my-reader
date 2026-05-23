import { NextRequest, NextResponse } from "next/server";
import {
  createSource,
  getObjective,
  updateSourceSemiontId,
} from "@/lib/repository";
import { syncSourceToSemiont } from "@/lib/semiont/client";
import { recordEvent, withTiming } from "@/lib/observability/events";
import { extractWebSource, WebScrapeError } from "@/lib/web/scrape";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { objective_id, url, refresh } = body;

    if (!objective_id || !url?.trim()) {
      return NextResponse.json({ error: "objective_id and url required" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("invalid protocol");
      }
    } catch {
      return NextResponse.json({ error: "Enter a valid http(s) URL" }, { status: 400 });
    }

    const objective = getObjective(objective_id);
    if (!objective) {
      return NextResponse.json({ error: "objective not found" }, { status: 404 });
    }

    const { result, latency_ms } = await withTiming(() =>
      extractWebSource(parsedUrl.toString(), { refresh: Boolean(refresh) })
    );
    const { fromCache, ...extraction } = result;

    const source = createSource({
      objective_id,
      url: parsedUrl.toString(),
      title: extraction.title,
      author: extraction.author,
      source_type: "web",
      text_content: extraction.text,
      semiont_resource_id: null,
      page_offsets: JSON.stringify(extraction.pageOffsets),
      total_pages: extraction.totalPages,
      content_hash: extraction.contentHash,
      byte_size: extraction.byteSize,
      file_path: null,
    });

    const semiontId = await syncSourceToSemiont(source);
    if (semiontId) {
      updateSourceSemiontId(source.id, semiontId);
      source.semiont_resource_id = semiontId;
    }

    await recordEvent({
      trace_id: objective.trace_id,
      objective_id: objective.id,
      event_type: "source_imported",
      object_type: "source",
      object_id: source.id,
      agent_name: "SourceAgent",
      source_url: parsedUrl.toString(),
      latency_ms,
      status: "success",
      metadata: {
        semiont_synced: Boolean(semiontId),
        source_type: "web",
        from_cache: fromCache,
        page_count: extraction.totalPages,
      },
    });

    return NextResponse.json(
      {
        ...source,
        pages: extraction.pages,
        page_count: extraction.pages.length,
        from_cache: fromCache,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof WebScrapeError) {
      return NextResponse.json({ error: e.message, url: e.url }, { status: 422 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
