"use client";

import { useState } from "react";
import type { AnthropicFeedLink } from "@/lib/types/anthropic-feed";

export function AnthropicFeedPanel({
  initialLinks,
  initialFetchedAt,
}: {
  initialLinks: AnthropicFeedLink[];
  initialFetchedAt: string | null;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/agents/fetch-anthropic", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Fetch failed");
      }

      const listRes = await fetch("/api/feeds/anthropic");
      const listData = await listRes.json();
      setLinks(listData.links ?? []);
      setFetchedAt(data.fetched_at ?? new Date().toISOString());
      setStatus(
        `Fetched ${data.added} new, ${data.updated} updated via ${data.method} (${data.total} total)`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }

  const research = links.filter((link) => link.source === "research");
  const engineering = links.filter((link) => link.source === "engineering");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">
            Automatic agent demo — latest links from Anthropic Research & Engineering blogs.
          </p>
          {fetchedAt && (
            <p className="mt-1 text-xs text-stone-400">
              Last fetch: {new Date(fetchedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {loading ? "Fetching…" : "Run fetch agent"}
        </button>
      </div>

      {status && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {status}
        </p>
      )}

      <FeedSection title="Research" links={research} badge="research" />
      <FeedSection title="Engineering" links={engineering} badge="engineering" />

      <section className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        <p className="font-medium text-stone-800">Trigger options</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            CLI: <code className="text-xs">npm run fetch:anthropic</code>
          </li>
          <li>
            API: <code className="text-xs">POST /api/agents/fetch-anthropic</code>
          </li>
          <li>
            JSON: <code className="text-xs">GET /api/feeds/anthropic</code>
          </li>
        </ul>
      </section>
    </div>
  );
}

function FeedSection({
  title,
  links,
  badge,
}: {
  title: string;
  links: AnthropicFeedLink[];
  badge: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          {links.length} links
        </span>
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-stone-500">
          No {badge} links yet. Run the fetch agent to populate this feed.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {links.map((link) => (
            <li key={link.id} className="px-4 py-3">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-stone-900 hover:text-amber-800"
              >
                {link.title}
              </a>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-stone-500">
                {link.published_at && <span>{link.published_at}</span>}
                <span className="truncate">{link.url}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
