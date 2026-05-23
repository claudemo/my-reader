"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import type { SourceSearchResult } from "@/lib/types";

export default function SourcesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sources, setSources] = useState<SourceSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sources/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: id }),
    });
    const data = await res.json();
    setSources(data.sources ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    search();
  }, [search]);

  async function importSource(source: SourceSearchResult) {
    setImporting(source.url);
    const res = await fetch("/api/sources/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective_id: id,
        url: source.url,
        title: source.title,
        source_type: source.source_type,
      }),
    });
    const data = await res.json();
    setImporting(null);
    if (res.ok) router.push(`/reader/${data.id}`);
  }

  return (
    <>
      <Nav objectiveId={id} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-semibold text-stone-900">Discover sources</h1>
        <p className="mb-6 text-stone-600">
          SourceAgent searches via Nimble (or demo sources when unconfigured).
        </p>

        {loading ? (
          <p className="text-stone-500">Searching…</p>
        ) : (
          <ul className="space-y-4">
            {sources.map((s) => (
              <li
                key={s.url}
                className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <p className="font-medium text-stone-900">{s.title}</p>
                <p className="mt-1 text-sm text-stone-600">{s.snippet}</p>
                <p className="mt-2 text-xs text-amber-800">{s.relevance_reason}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => importSource(s)}
                    disabled={importing === s.url}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {importing === s.url ? "Importing…" : "Import & read"}
                  </button>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700"
                  >
                    Open original
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex gap-4 text-sm">
          <Link href={`/objectives/${id}/notes`} className="text-amber-800 hover:underline">
            Skip to notes →
          </Link>
          <Link href={`/objectives/${id}/trace`} className="text-stone-500 hover:underline">
            View trace
          </Link>
        </div>
      </main>
    </>
  );
}
