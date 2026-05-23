import { slicePagesFromText } from "@/lib/pdf/extract";
import type { Source } from "@/lib/types";

export interface DocumentPassage {
  source_id: string;
  source_title: string;
  page_index: number;
  text: string;
  score: number;
}

export interface DocumentOutlineSection {
  source_id: string;
  source_title: string;
  page_index: number;
  heading: string;
  preview: string;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "from",
  "have",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
  "learn",
  "reading",
  "understand",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function scoreParagraph(paragraph: string, keywords: string[]): number {
  const lower = paragraph.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      score += keyword.length > 6 ? 3 : 2;
    }
  }

  if (/^(#{1,3}\s|abstract|introduction|summary|conclusion|takeaway)/i.test(paragraph.trim())) {
    score += 2;
  }

  const words = paragraph.split(/\s+/).length;
  if (words >= 30 && words <= 220) score += 2;
  if (words < 18) score -= 1;

  return score;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 40);
}

function preview(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

function headingFromParagraph(text: string): string {
  const markdown = text.match(/^#{1,6}\s+(.+)/);
  if (markdown?.[1]) return markdown[1].trim();
  const sentence = text.split(/[.!?]/)[0]?.trim();
  return preview(sentence || text, 90);
}

export function extractDocumentPassages(
  sources: Source[],
  objectiveText: string,
  limit = 14
): DocumentPassage[] {
  const keywords = [...new Set(tokenize(objectiveText))];
  const passages: DocumentPassage[] = [];

  for (const source of sources) {
    const pages = slicePagesFromText(
      source.text_content,
      source.page_offsets ?? null,
      source.total_pages ?? null
    );

    pages.forEach((pageText, pageIndex) => {
      for (const paragraph of splitParagraphs(pageText)) {
        const score = scoreParagraph(paragraph, keywords);
        if (score <= 0) continue;
        passages.push({
          source_id: source.id,
          source_title: source.title,
          page_index: pageIndex,
          text: paragraph,
          score,
        });
      }
    });
  }

  passages.sort((a, b) => b.score - a.score);

  const picked: DocumentPassage[] = [];
  const perPage = new Map<string, number>();

  for (const passage of passages) {
    const key = `${passage.source_id}:${passage.page_index}`;
    if ((perPage.get(key) ?? 0) >= 2) continue;
    picked.push(passage);
    perPage.set(key, (perPage.get(key) ?? 0) + 1);
    if (picked.length >= limit) break;
  }

  return picked;
}

export function buildDocumentOutline(sources: Source[]): DocumentOutlineSection[] {
  const outline: DocumentOutlineSection[] = [];

  for (const source of sources) {
    const pages = slicePagesFromText(
      source.text_content,
      source.page_offsets ?? null,
      source.total_pages ?? null
    );

    pages.forEach((pageText, pageIndex) => {
      const paragraphs = splitParagraphs(pageText);
      const headingParagraph =
        paragraphs.find((p) => /^#{1,3}\s/.test(p)) ??
        paragraphs.find((p) => /^[A-Z][A-Za-z0-9\s-]{3,}$/.test(p)) ??
        paragraphs[0];

      if (!headingParagraph) return;

      outline.push({
        source_id: source.id,
        source_title: source.title,
        page_index: pageIndex,
        heading: headingFromParagraph(headingParagraph),
        preview: preview(headingParagraph),
      });
    });
  }

  return outline.slice(0, 24);
}

export function summarizeDocumentContext(
  sources: Source[],
  objectiveText: string
): {
  passages: DocumentPassage[];
  outline: DocumentOutlineSection[];
  total_pages: number;
} {
  const passages = extractDocumentPassages(sources, objectiveText);
  const outline = buildDocumentOutline(sources);
  const total_pages = sources.reduce((sum, source) => sum + (source.total_pages ?? 1), 0);

  return { passages, outline, total_pages };
}
