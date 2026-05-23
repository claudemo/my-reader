import { getDb } from "@/lib/db";
import { newId } from "@/lib/utils/ids";
import type {
  AnthropicFeedLink,
  AnthropicFeedSource,
  AnthropicFetchResult,
} from "@/lib/types/anthropic-feed";

export interface UpsertAnthropicLinkInput {
  title: string;
  url: string;
  source: AnthropicFeedSource;
  published_at?: string | null;
}

export function upsertAnthropicFeedLinks(
  links: UpsertAnthropicLinkInput[]
): Pick<AnthropicFetchResult, "added" | "updated"> {
  const db = getDb();
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  const existingStmt = db.prepare("SELECT id FROM anthropic_feed_links WHERE url = ?");
  const insertStmt = db.prepare(
    `INSERT INTO anthropic_feed_links (id, title, url, source, published_at, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const updateStmt = db.prepare(
    `UPDATE anthropic_feed_links
     SET title = ?, source = ?, published_at = ?, fetched_at = ?
     WHERE url = ?`
  );

  for (const link of links) {
    const existing = existingStmt.get(link.url) as { id: string } | undefined;
    if (existing) {
      updateStmt.run(
        link.title,
        link.source,
        link.published_at ?? null,
        now,
        link.url
      );
      updated += 1;
    } else {
      insertStmt.run(
        newId("afl"),
        link.title,
        link.url,
        link.source,
        link.published_at ?? null,
        now
      );
      added += 1;
    }
  }

  return { added, updated };
}

export function listAnthropicFeedLinks(options?: {
  source?: AnthropicFeedSource;
  limit?: number;
}): AnthropicFeedLink[] {
  const db = getDb();
  const limit = options?.limit ?? 100;

  if (options?.source) {
    return db
      .prepare(
        `SELECT * FROM anthropic_feed_links
         WHERE source = ?
         ORDER BY COALESCE(published_at, fetched_at) DESC, fetched_at DESC
         LIMIT ?`
      )
      .all(options.source, limit) as AnthropicFeedLink[];
  }

  return db
    .prepare(
      `SELECT * FROM anthropic_feed_links
       ORDER BY COALESCE(published_at, fetched_at) DESC, fetched_at DESC
       LIMIT ?`
    )
    .all(limit) as AnthropicFeedLink[];
}

export function countAnthropicFeedLinks(): Record<AnthropicFeedSource, number> {
  const rows = getDb()
    .prepare(
      `SELECT source, COUNT(*) as count
       FROM anthropic_feed_links
       GROUP BY source`
    )
    .all() as Array<{ source: AnthropicFeedSource; count: number }>;

  return {
    research: rows.find((r) => r.source === "research")?.count ?? 0,
    engineering: rows.find((r) => r.source === "engineering")?.count ?? 0,
  };
}
