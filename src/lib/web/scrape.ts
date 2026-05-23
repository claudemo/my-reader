import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import {
  buildParsedExtraction,
  extractPdfBuffer,
  getParsedDocCacheAsync,
  getParsedDocCacheByUrlAsync,
  normalizeWebUrl,
  saveParsedDocCache,
  webCacheKey,
  type ParsedExtraction,
} from "@/lib/pdf/extract";

export class WebScrapeError extends Error {
  constructor(
    message: string,
    readonly url: string
  ) {
    super(message);
    this.name = "WebScrapeError";
  }
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const CONTENT_SELECTORS = [
  "article",
  "main",
  '[role="main"]',
  ".markdown-body",
  ".post-content",
  ".entry-content",
  ".article-content",
  ".article-body",
  ".blog-post",
  ".content",
  "#content",
  "#main-content",
  ".documentation",
  ".docs-content",
];

function parseArxivId(url: string): string | null {
  const match = url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  return match[1].replace(/\.pdf$/i, "").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function stripHtmlFallback(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function htmlFragmentToText(html: string): string {
  const wrapped = html.trim().startsWith("<") ? html : `<div>${html}</div>`;
  const { document } = parseHTML(`<!DOCTYPE html><body>${wrapped}</body>`);
  const blocks: string[] = [];

  const blockTags = new Set([
    "P",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "BLOCKQUOTE",
    "PRE",
    "TD",
    "TH",
    "FIGCAPTION",
    "DIV",
  ]);

  function walk(node: Element) {
    const tag = node.tagName;
    if (blockTags.has(tag)) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (text && text.length > 1) {
        if (/^H[1-6]$/.test(tag)) {
          const level = Number(tag.slice(1));
          blocks.push(`${"#".repeat(Math.min(level, 6))} ${text}`);
        } else if (tag === "LI") {
          blocks.push(`- ${text}`);
        } else if (tag === "BLOCKQUOTE") {
          blocks.push(text.split("\n").map((line) => `> ${line}`).join("\n"));
        } else {
          blocks.push(text);
        }
      }
      return;
    }

    for (const child of Array.from(node.children)) {
      walk(child);
    }
  }

  for (const child of Array.from(document.body.children)) {
    walk(child);
  }

  if (blocks.length === 0) {
    const fallback = document.body.textContent?.replace(/\s+/g, " ").trim();
    return fallback ?? "";
  }

  return blocks.join("\n\n");
}

function scoreText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const words = trimmed.split(/\s+/).length;
  const lines = trimmed.split("\n").filter((line) => line.trim());
  const avgLineLength = trimmed.length / Math.max(lines.length, 1);

  let score = words;
  if (avgLineLength < 28 && lines.length > 80) score *= 0.45;
  if (words < 120) score *= 0.7;
  return score;
}

function extractFromSelectors(document: Document): string {
  for (const selector of CONTENT_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll(selector));
    const texts = nodes
      .map((node) => htmlFragmentToText(node.innerHTML))
      .filter((text) => text.length > 200)
      .sort((a, b) => b.length - a.length);

    if (texts[0]) return texts[0];
  }
  return "";
}

function buildDocument(html: string, url: string) {
  const { document } = parseHTML(html);
  const base = new URL(url);

  Object.defineProperty(document, "documentURI", { value: url });
  Object.defineProperty(document, "URL", { value: url });

  document.querySelectorAll("a[href]").forEach((node) => {
    const anchor = node as HTMLAnchorElement;
    try {
      anchor.href = new URL(anchor.getAttribute("href") ?? "", base).toString();
    } catch {
      /* ignore bad href */
    }
  });

  return { document, hostname: base.hostname.replace(/^www\./, "") };
}

function extractReadableArticle(html: string, url: string): {
  title: string;
  author: string;
  text: string;
} {
  const { document, hostname } = buildDocument(html, url);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const fallbackTitle = titleMatch?.[1]?.replace(/\s+/g, " ").trim() || hostname;

  const candidates: Array<{ label: string; text: string; title?: string; author?: string }> = [];

  const reader = new Readability(document, {
    charThreshold: 12,
    nbTopCandidates: 8,
  });
  const article = reader.parse();

  if (article?.content) {
    candidates.push({
      label: "readability-html",
      text: htmlFragmentToText(article.content),
      title: article.title ?? undefined,
      author: article.byline ?? article.siteName ?? undefined,
    });
  }

  if (article?.textContent?.trim()) {
    candidates.push({
      label: "readability-text",
      text: article.textContent.trim(),
      title: article.title ?? undefined,
      author: article.byline ?? article.siteName ?? undefined,
    });
  }

  const selectorText = extractFromSelectors(document);
  if (selectorText) {
    candidates.push({ label: "selectors", text: selectorText });
  }

  const fallbackText = stripHtmlFallback(html);
  if (fallbackText) {
    candidates.push({ label: "fallback", text: fallbackText });
  }

  const best = candidates
    .filter((candidate) => candidate.text.trim().length >= 200)
    .sort((a, b) => scoreText(b.text) - scoreText(a.text))[0];

  if (!best) {
    return { title: fallbackTitle, author: hostname, text: fallbackText };
  }

  return {
    title: best.title?.trim() || fallbackTitle,
    author: best.author?.trim() || hostname,
    text: best.text.trim(),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new WebScrapeError(`Could not fetch page (HTTP ${res.status})`, url);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    throw new WebScrapeError("URL points to a PDF — upload the file instead.", url);
  }

  return res.text();
}

async function scrapeArxivPdf(arxivId: string, canonicalUrl: string): Promise<ParsedExtraction> {
  const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
  const res = await fetch(pdfUrl, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(60_000),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new WebScrapeError(`Could not fetch arXiv PDF (HTTP ${res.status})`, canonicalUrl);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const extraction = await extractPdfBuffer(buffer, `${arxivId}.pdf`);
  extraction.title = extraction.title || `arXiv ${arxivId}`;
  extraction.author = extraction.author || "arXiv";
  return extraction;
}

async function scrapeArxivHtml(arxivId: string, canonicalUrl: string): Promise<{
  title: string;
  author: string;
  text: string;
} | null> {
  const htmlUrl = `https://arxiv.org/html/${arxivId}`;
  try {
    const html = await fetchHtml(htmlUrl);
    const article = extractReadableArticle(html, htmlUrl);
    if (article.text.length >= 1000) {
      return {
        title: article.title || `arXiv ${arxivId}`,
        author: article.author || "arXiv",
        text: article.text,
      };
    }
  } catch {
    /* fall back to PDF */
  }
  return null;
}

async function scrapeArxiv(arxivId: string, canonicalUrl: string): Promise<{
  title: string;
  author: string;
  text: string;
}> {
  const htmlArticle = await scrapeArxivHtml(arxivId, canonicalUrl);
  if (htmlArticle) return htmlArticle;

  const pdfExtraction = await scrapeArxivPdf(arxivId, canonicalUrl);
  return {
    title: pdfExtraction.title,
    author: pdfExtraction.author,
    text: pdfExtraction.text,
  };
}

async function scrapeRemoteUrl(canonicalUrl: string): Promise<{
  title: string;
  author: string;
  text: string;
}> {
  const arxivId = parseArxivId(canonicalUrl);
  if (arxivId) {
    return scrapeArxiv(arxivId, canonicalUrl);
  }

  const html = await fetchHtml(canonicalUrl);
  const article = extractReadableArticle(html, canonicalUrl);

  if (article.text.length < 200) {
    throw new WebScrapeError(
      "Could not extract enough readable text from this page. Try uploading a PDF instead.",
      canonicalUrl
    );
  }

  return article;
}

export async function extractWebSource(
  rawUrl: string,
  options?: { refresh?: boolean }
): Promise<ParsedExtraction & { fromCache: boolean }> {
  const canonicalUrl = normalizeWebUrl(rawUrl);
  const cacheKey = webCacheKey(canonicalUrl);

  if (!options?.refresh) {
    const cached =
      (await getParsedDocCacheAsync(cacheKey)) ??
      (await getParsedDocCacheByUrlAsync(canonicalUrl));
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  const article = await scrapeRemoteUrl(canonicalUrl);
  const extraction = buildParsedExtraction(
    article.text,
    article.title,
    article.author,
    "web",
    cacheKey
  );

  saveParsedDocCache(extraction, {
    cacheKey,
    canonicalUrl,
    sourceType: "web",
  });

  return { ...extraction, fromCache: false };
}
