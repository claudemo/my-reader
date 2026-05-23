import { parseHTML } from "linkedom";
import {
  countAnthropicFeedLinks,
  listAnthropicFeedLinks,
  upsertAnthropicFeedLinks,
} from "@/lib/repository/anthropic-feed";
import type {
  AnthropicFeedSource,
  AnthropicFetchResult,
} from "@/lib/types/anthropic-feed";

const BASE_URL = "https://www.anthropic.com";

const RSS_CANDIDATES = [
  `${BASE_URL}/rss.xml`,
  `${BASE_URL}/feed.xml`,
  `${BASE_URL}/research/rss.xml`,
  `${BASE_URL}/engineering/rss.xml`,
  `${BASE_URL}/research/feed.xml`,
  `${BASE_URL}/engineering/feed.xml`,
];

const LISTING_PAGES: Array<{ source: AnthropicFeedSource; url: string; pathPrefix: string }> =
  [
    { source: "research", url: `${BASE_URL}/research`, pathPrefix: "/research/" },
    {
      source: "engineering",
      url: `${BASE_URL}/engineering`,
      pathPrefix: "/engineering/",
    },
  ];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; MyReader-Agent/1.0; +https://github.com/my-reader)",
  Accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface ParsedAnthropicLink {
  title: string;
  url: string;
  source: AnthropicFeedSource;
  published_at: string | null;
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeUrl(href: string): string {
  if (href.startsWith("http")) return href.split("#")[0]!;
  return `${BASE_URL}${href.startsWith("/") ? href : `/${href}`}`.split("#")[0]!;
}

function inferSource(url: string): AnthropicFeedSource | null {
  if (url.includes("/research/")) return "research";
  if (url.includes("/engineering/")) return "engineering";
  return null;
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function parseRssFeed(xml: string): ParsedAnthropicLink[] {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  const links: ParsedAnthropicLink[] = [];

  for (const [, body] of items) {
    const linkMatch =
      body.match(/<link>([^<]+)<\/link>/i) ??
      body.match(/<guid[^>]*>([^<]+)<\/guid>/i);
    const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
    const dateMatch =
      body.match(/<pubDate>([^<]+)<\/pubDate>/i) ??
      body.match(/<updated>([^<]+)<\/updated>/i);

    const url = linkMatch?.[1] ? decodeXml(linkMatch[1]) : null;
    const title = titleMatch?.[1] ? decodeXml(titleMatch[1]) : null;
    if (!url || !title) continue;

    const source = inferSource(url);
    if (!source) continue;

    links.push({
      title,
      url: normalizeUrl(url),
      source,
      published_at: dateMatch?.[1] ? decodeXml(dateMatch[1]) : null,
    });
  }

  return links;
}

function parseAtomFeed(xml: string): ParsedAnthropicLink[] {
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  const links: ParsedAnthropicLink[] = [];

  for (const [, body] of entries) {
    const linkMatch = body.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
    const dateMatch =
      body.match(/<published>([^<]+)<\/published>/i) ??
      body.match(/<updated>([^<]+)<\/updated>/i);

    const url = linkMatch?.[1] ? decodeXml(linkMatch[1]) : null;
    const title = titleMatch?.[1] ? decodeXml(titleMatch[1]) : null;
    if (!url || !title) continue;

    const source = inferSource(url);
    if (!source) continue;

    links.push({
      title,
      url: normalizeUrl(url),
      source,
      published_at: dateMatch?.[1] ? decodeXml(dateMatch[1]) : null,
    });
  }

  return links;
}

async function tryFetchRss(): Promise<ParsedAnthropicLink[] | null> {
  for (const feedUrl of RSS_CANDIDATES) {
    try {
      const res = await fetch(feedUrl, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(12_000),
        redirect: "follow",
      });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      const xml = await res.text();
      if (!xml.includes("<rss") && !xml.includes("<feed")) continue;

      const parsed = xml.includes("<feed")
        ? parseAtomFeed(xml)
        : parseRssFeed(xml);

      if (parsed.length > 0) {
        return parsed;
      }

      if (contentType.includes("xml")) {
        return parsed;
      }
    } catch {
      /* try next candidate */
    }
  }

  return null;
}

function extractTitle(anchor: Element, href: string): string {
  const heading = anchor.querySelector("h2, h3, h4")?.textContent?.trim();
  if (heading) return heading;

  const text = anchor.textContent?.replace(/\s+/g, " ").trim();
  if (text && text.length > 3 && text.length < 200) return text;

  const slug = href.split("/").filter(Boolean).pop();
  return slug ? slugToTitle(slug) : href;
}

function extractPublishedAt(anchor: Element): string | null {
  const time = anchor.querySelector("time")?.textContent?.trim();
  if (time) return time;

  const dateNode = anchor.querySelector('[class*="date"], [class*="Date"]');
  const dateText = dateNode?.textContent?.replace(/\s+/g, " ").trim();
  return dateText && dateText.length < 40 ? dateText : null;
}

function parseListingPage(
  html: string,
  source: AnthropicFeedSource,
  pathPrefix: string
): ParsedAnthropicLink[] {
  const { document } = parseHTML(html);
  const seen = new Set<string>();
  const links: ParsedAnthropicLink[] = [];

  for (const anchor of document.querySelectorAll(`a[href^="${pathPrefix}"]`)) {
    const href = anchor.getAttribute("href");
    if (!href || href.includes("/team/")) continue;

    const url = normalizeUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);

    links.push({
      title: extractTitle(anchor, href),
      url,
      source,
      published_at: extractPublishedAt(anchor),
    });
  }

  return links;
}

async function fetchListingPage(
  source: AnthropicFeedSource,
  url: string,
  pathPrefix: string
): Promise<ParsedAnthropicLink[]> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`${source} listing fetch failed (HTTP ${res.status})`);
  }

  const html = await res.text();
  return parseListingPage(html, source, pathPrefix);
}

function dedupeByUrl(links: ParsedAnthropicLink[]): ParsedAnthropicLink[] {
  const byUrl = new Map<string, ParsedAnthropicLink>();
  for (const link of links) {
    const existing = byUrl.get(link.url);
    if (!existing) {
      byUrl.set(link.url, link);
      continue;
    }

    byUrl.set(link.url, {
      ...existing,
      title: existing.title.length >= link.title.length ? existing.title : link.title,
      published_at: existing.published_at ?? link.published_at,
    });
  }
  return [...byUrl.values()];
}

export async function fetchAnthropicBlogLinks(): Promise<{
  links: ParsedAnthropicLink[];
  method: "rss" | "html";
  errors: string[];
}> {
  const errors: string[] = [];

  const rssLinks = await tryFetchRss();
  if (rssLinks && rssLinks.length > 0) {
    return { links: dedupeByUrl(rssLinks), method: "rss", errors };
  }

  const htmlLinks: ParsedAnthropicLink[] = [];
  for (const page of LISTING_PAGES) {
    try {
      const pageLinks = await fetchListingPage(page.source, page.url, page.pathPrefix);
      htmlLinks.push(...pageLinks);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `Failed to fetch ${page.source} listing`
      );
    }
  }

  if (htmlLinks.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return { links: dedupeByUrl(htmlLinks), method: "html", errors };
}

export async function runAnthropicFeedAgent(): Promise<AnthropicFetchResult> {
  const { links, method, errors } = await fetchAnthropicBlogLinks();
  const { added, updated } = upsertAnthropicFeedLinks(links);
  const counts = countAnthropicFeedLinks();

  const result: AnthropicFetchResult = {
    added,
    updated,
    total: listAnthropicFeedLinks().length,
    sources: counts,
    fetched_at: new Date().toISOString(),
    method,
    errors,
  };

  console.log(
    JSON.stringify({
      agent: "AnthropicFeedAgent",
      event_type: "anthropic_feed_fetched",
      status: errors.length > 0 ? "partial" : "success",
      ...result,
    })
  );

  return result;
}
