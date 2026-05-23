import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSource } from "@/lib/repository";

const UPLOADS_ROOT = path.join(process.cwd(), "data", "uploads");

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "text/plain; charset=utf-8";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = getSource(id);
  if (!source?.file_path) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const resolved = path.resolve(source.file_path);
  if (!resolved.startsWith(UPLOADS_ROOT) || !fs.existsSync(resolved)) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolved);
  const filename = path.basename(resolved);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentTypeFor(filename),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
