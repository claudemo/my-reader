import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import {
  getParsedDocCacheByUrl as getClickHouseParsedDocByUrl,
  getParsedDocCache as getClickHouseParsedDoc,
  hydrateParsedExtraction,
  upsertParsedDocCache,
} from "@/lib/clickhouse/client";
import { extractText, getDocumentProxy } from "unpdf";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
export const EXTRACTION_VERSION = 4;

export interface PdfExtraction {
  text: string;
  pages: string[];
  totalPages: number;
  title: string;
  author: string;
  contentHash: string;
  byteSize: number;
  pageOffsets: number[];
}

export type ParsedExtraction = PdfExtraction;

type CacheRow = {
  cache_key: string;
  canonical_url: string | null;
  source_type: string;
  text: string;
  page_offsets: string;
  total_pages: number;
  doc_title: string | null;
  doc_author: string | null;
  byte_size: number;
};

export function ensureUploadsDir(sourceId?: string) {
  const dir = sourceId ? path.join(UPLOADS_DIR, sourceId) : UPLOADS_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function hashWithVersion(buffer: Buffer): string {
  return hashBuffer(Buffer.concat([buffer, Buffer.from(`extract-v${EXTRACTION_VERSION}`)]));
}

export function normalizeWebUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());
  url.hash = "";
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach(
    (key) => url.searchParams.delete(key)
  );
  if (url.pathname.endsWith("/") && url.pathname.length > 1) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function webCacheKey(canonicalUrl: string): string {
  return hashBuffer(Buffer.from(`web-v${EXTRACTION_VERSION}:${canonicalUrl}`));
}

function endsSentence(line: string): boolean {
  return /[.!?。！？]["')\]」』]*$/.test(line.trim());
}

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^#{1,6}\s/.test(trimmed) ||
    /^\d+(\.\d+)*[\.)]\s+\S/.test(trimmed) ||
    (/^[A-Z0-9][A-Z0-9\s\-:]{2,}$/.test(trimmed) && trimmed.length < 90) ||
    /^(abstract|introduction|background|methods|results|discussion|conclusion|references|appendix)\b/i.test(
      trimmed
    )
  );
}

function shouldStartNewParagraph(previous: string, next: string): boolean {
  if (!previous || !next) return true;
  if (isHeadingLine(next)) return true;
  if (/^[-•*●▪]\s/.test(next)) return true;
  if (/^\d+[\.)]\s/.test(next)) return true;

  const prev = previous.trim();
  const gapAfterSentence = endsSentence(prev) && prev.length > 24;
  if (gapAfterSentence && /^[A-Z["'(【「]/.test(next)) return true;
  if (gapAfterSentence && /^[一-龥]/.test(next) && prev.length > 40) return true;

  return false;
}

function shouldMergeLine(previous: string, next: string): boolean {
  if (!previous || !next) return false;
  if (shouldStartNewParagraph(previous, next)) return false;
  if (/^[-•*●▪]\s/.test(next)) return false;
  if (isHeadingLine(next)) return false;
  if (/^[a-z(["'【「]/.test(next)) return true;
  if (!endsSentence(previous)) return true;
  if (previous.length < 55) return true;
  return false;
}

function splitLongParagraph(text: string, target = 420): string[] {
  if (text.length <= target * 1.35) return [text];

  const parts = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) ?? [text];
  const chunks: string[] = [];
  let buffer = "";

  for (const part of parts) {
    const candidate = buffer ? `${buffer}${part}` : part;
    if (candidate.length > target && buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = part;
    } else {
      buffer = candidate;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.length ? chunks : [text];
}

function segmentPlainBlob(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) ?? [normalized];
  const paragraphs: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const next = buffer ? `${buffer} ${trimmed}` : trimmed;
    if (next.length > 360 && buffer.trim()) {
      paragraphs.push(buffer.trim());
      buffer = trimmed;
    } else {
      buffer = next;
    }
  }

  if (buffer.trim()) paragraphs.push(buffer.trim());
  return paragraphs;
}

/** Reflow PDF line breaks into readable paragraphs. */
export function reflowPdfText(raw: string): string {
  if (!raw.trim()) return "";

  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/([A-Za-z0-9])-\n([a-z])/g, "$1$2");
  text = text.replace(/[ \t]+\n/g, "\n");

  const lines = text.split("\n").map((line) => line.replace(/[^\S\n]+/g, " ").trim());

  if (lines.filter(Boolean).length <= 1) {
    return segmentPlainBlob(lines.join(" ")).join("\n\n");
  }

  const paragraphs: string[] = [];
  let current = "";

  const flush = () => {
    if (!current.trim()) return;
    for (const chunk of splitLongParagraph(current.trim())) {
      paragraphs.push(chunk);
    }
    current = "";
  };

  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }

    if (isHeadingLine(line)) {
      flush();
      paragraphs.push(line);
      continue;
    }

    if (!current) {
      current = line;
      continue;
    }

    if (shouldMergeLine(current, line)) {
      current = `${current} ${line}`;
    } else {
      flush();
      current = line;
    }
  }

  flush();

  return paragraphs.join("\n\n");
}

function normalizeWebText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function normalizeText(raw: string, sourceType: "pdf" | "text" | "web" = "pdf"): string {
  if (sourceType === "web") return normalizeWebText(raw);
  return reflowPdfText(raw);
}

const PAGE_SEPARATOR = "\n\n";
const WEB_PAGE_TARGET_CHARS = 4500;

function paginateParagraphs(paragraphs: string[], targetChars = WEB_PAGE_TARGET_CHARS): string[] {
  if (paragraphs.length === 0) return ["(empty document)"];

  const pages: string[] = [];
  let batch: string[] = [];
  let size = 0;

  for (const paragraph of paragraphs) {
    const nextSize = size + paragraph.length + (batch.length ? PAGE_SEPARATOR.length : 0);
    if (batch.length > 0 && nextSize > targetChars) {
      pages.push(batch.join(PAGE_SEPARATOR));
      batch = [paragraph];
      size = paragraph.length;
      continue;
    }
    batch.push(paragraph);
    size = nextSize;
  }

  if (batch.length) {
    pages.push(batch.join(PAGE_SEPARATOR));
  }

  return pages;
}

function buildPageOffsets(pages: string[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const page of pages) {
    offsets.push(cursor);
    cursor += page.length + PAGE_SEPARATOR.length;
  }
  return offsets;
}

export function slicePagesFromText(
  text: string,
  pageOffsetsJson: string | null,
  totalPages: number | null
): string[] {
  if (pageOffsetsJson && totalPages) {
    try {
      const offsets: number[] = JSON.parse(pageOffsetsJson);
      if (offsets.length > 0) {
        return offsets.map((start, i) => {
          const end = i + 1 < offsets.length ? offsets[i + 1] : text.length;
          let chunk = text.slice(start, end);
          if (i + 1 < offsets.length) {
            chunk = chunk.replace(/\n\n$/, "");
          }
          return chunk;
        });
      }
    } catch {
      /* fall through */
    }
  }

  const chunks = text.split(/\n\n+/).filter((p) => p.trim().length > 20);
  return chunks.length ? chunks : [text];
}

function rowToExtraction(row: CacheRow): PdfExtraction {
  const pages = slicePagesFromText(row.text, row.page_offsets, row.total_pages);
  return {
    text: row.text,
    pages: pages.length ? pages : [row.text],
    totalPages: row.total_pages,
    title: row.doc_title ?? "Document",
    author: row.doc_author ?? "Unknown",
    contentHash: row.cache_key,
    byteSize: row.byte_size,
    pageOffsets: JSON.parse(row.page_offsets) as number[],
  };
}

function readLegacyPdfCache(hash: string): PdfExtraction | null {
  const row = getDb()
    .prepare("SELECT * FROM pdf_extract_cache WHERE content_hash = ?")
    .get(hash) as
    | {
        text: string;
        page_offsets: string;
        total_pages: number;
        pdf_title: string | null;
        pdf_author: string | null;
        byte_size: number;
      }
    | undefined;
  if (!row) return null;

  return {
    text: row.text,
    pages: slicePagesFromText(row.text, row.page_offsets, row.total_pages),
    totalPages: row.total_pages,
    title: row.pdf_title ?? "Uploaded document",
    author: row.pdf_author ?? "Unknown",
    contentHash: hash,
    byteSize: row.byte_size,
    pageOffsets: JSON.parse(row.page_offsets) as number[],
  };
}

export async function getParsedDocCacheAsync(cacheKey: string): Promise<PdfExtraction | null> {
  const fromClickHouse = await getClickHouseParsedDoc(cacheKey);
  if (fromClickHouse) return hydrateParsedExtraction(fromClickHouse);

  const local = getParsedDocCache(cacheKey);
  return local;
}

export async function getParsedDocCacheByUrlAsync(
  canonicalUrl: string
): Promise<PdfExtraction | null> {
  const fromClickHouse = await getClickHouseParsedDocByUrl(canonicalUrl);
  if (fromClickHouse) return hydrateParsedExtraction(fromClickHouse);

  return getParsedDocCacheByUrl(canonicalUrl);
}

export function getParsedDocCache(cacheKey: string): PdfExtraction | null {
  const row = getDb()
    .prepare("SELECT * FROM parsed_doc_cache WHERE cache_key = ?")
    .get(cacheKey) as CacheRow | undefined;
  if (row) return rowToExtraction(row);
  return readLegacyPdfCache(cacheKey);
}

export function getParsedDocCacheByUrl(canonicalUrl: string): PdfExtraction | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM parsed_doc_cache WHERE canonical_url = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(canonicalUrl) as CacheRow | undefined;
  return row ? rowToExtraction(row) : null;
}

export function saveParsedDocCache(
  extraction: PdfExtraction,
  meta: {
    cacheKey: string;
    canonicalUrl?: string | null;
    sourceType: "pdf" | "text" | "web";
  }
) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO parsed_doc_cache
       (cache_key, canonical_url, source_type, text, page_offsets, total_pages, doc_title, doc_author, byte_size, extraction_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      meta.cacheKey,
      meta.canonicalUrl ?? null,
      meta.sourceType,
      extraction.text,
      JSON.stringify(extraction.pageOffsets),
      extraction.totalPages,
      extraction.title,
      extraction.author,
      extraction.byteSize,
      EXTRACTION_VERSION,
      now
    );

  getDb()
    .prepare(
      `INSERT OR REPLACE INTO pdf_extract_cache
       (content_hash, text, page_offsets, total_pages, pdf_title, pdf_author, byte_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      meta.cacheKey,
      extraction.text,
      JSON.stringify(extraction.pageOffsets),
      extraction.totalPages,
      extraction.title,
      extraction.author,
      extraction.byteSize,
      now
    );

  void upsertParsedDocCache(extraction, {
    cacheKey: meta.cacheKey,
    canonicalUrl: meta.canonicalUrl,
    sourceType: meta.sourceType,
    extractionVersion: EXTRACTION_VERSION,
  });
}

export function buildParsedExtraction(
  text: string,
  title: string,
  author: string,
  sourceType: "pdf" | "text" | "web",
  cacheKey?: string
): PdfExtraction {
  const normalized = normalizeText(text, sourceType);
  const paragraphs = normalized
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pageList = paginateParagraphs(paragraphs);
  const fullText = paragraphs.join(PAGE_SEPARATOR);
  const buf = Buffer.from(fullText, "utf-8");
  const contentHash =
    cacheKey ?? hashBuffer(Buffer.concat([buf, Buffer.from(`${sourceType}-v${EXTRACTION_VERSION}`)]));

  return {
    text: fullText,
    pages: pageList,
    totalPages: pageList.length,
    title,
    author,
    contentHash,
    byteSize: buf.length,
    pageOffsets: buildPageOffsets(pageList),
  };
}

export async function extractPdfBuffer(
  buffer: Buffer,
  filename: string
): Promise<PdfExtraction> {
  const contentHash = hashWithVersion(buffer);
  const cached = await getParsedDocCacheAsync(contentHash);
  if (cached) return cached;

  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text: pageTexts, totalPages } = await extractText(pdf, { mergePages: false });
  const pageCount = totalPages || pageTexts.length || 1;
  const pages = Array.from({ length: pageCount }, (_, i) =>
    normalizeText(pageTexts[i] ?? "")
  );
  const fullText = pages.join(PAGE_SEPARATOR);
  const title = filename.replace(/\.pdf$/i, "") || "Uploaded PDF";

  const extraction: PdfExtraction = {
    text: fullText,
    pages,
    totalPages: pageCount,
    title,
    author: "PDF upload",
    contentHash,
    byteSize: buffer.length,
    pageOffsets: buildPageOffsets(pages),
  };

  saveParsedDocCache(extraction, { cacheKey: contentHash, sourceType: "pdf" });
  return extraction;
}

export function extractTextFile(
  buffer: Buffer,
  filename: string
): PdfExtraction {
  const contentHash = hashWithVersion(buffer);
  const cached = getParsedDocCache(contentHash);
  if (cached) return cached;

  const text = normalizeText(buffer.toString("utf-8"), "text");
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const pageList = paginateParagraphs(paragraphs);
  const fullText = paragraphs.length ? paragraphs.join(PAGE_SEPARATOR) : text;

  const extraction: PdfExtraction = {
    text: fullText,
    pages: pageList,
    totalPages: pageList.length,
    title: filename.replace(/\.(txt|md)$/i, "") || "Uploaded document",
    author: "File upload",
    contentHash,
    byteSize: buffer.length,
    pageOffsets: buildPageOffsets(pageList),
  };

  saveParsedDocCache(extraction, { cacheKey: contentHash, sourceType: "text" });
  return extraction;
}

export function paginateExtractedText(
  text: string,
  title: string,
  author: string
): PdfExtraction {
  return buildParsedExtraction(text, title, author, "web");
}

export function saveUploadedFile(sourceId: string, filename: string, buffer: Buffer) {
  const dir = ensureUploadsDir(sourceId);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(dir, safeName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function getMaxPdfBytes(): number {
  const n = Number(process.env.PDF_MAX_BYTES ?? 52_428_800);
  return Number.isFinite(n) ? n : 52_428_800;
}

export function getMaxPdfPages(): number {
  const n = Number(process.env.PDF_MAX_PAGES ?? 500);
  return Number.isFinite(n) ? n : 500;
}
