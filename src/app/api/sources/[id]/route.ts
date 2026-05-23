import { NextResponse } from "next/server";
import { getSource } from "@/lib/repository";
import { slicePagesFromText } from "@/lib/pdf/extract";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = getSource(id);
  if (!source) {
    return NextResponse.json({ error: "source not found" }, { status: 404 });
  }

  const pages = slicePagesFromText(
    source.text_content,
    source.page_offsets ?? null,
    source.total_pages ?? null
  );

  return NextResponse.json({
    ...source,
    pages,
    page_count: pages.length,
    is_upload: source.url.startsWith("upload://"),
  });
}
