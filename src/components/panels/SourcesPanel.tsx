"use client";

import { useCallback, useEffect, useState } from "react";

export function SourcesPanel({
  objectiveId,
  onImported,
}: {
  objectiveId: string;
  onImported: (sourceId: string) => void;
}) {
  const [sources, setSources] = useState<
    Array<{ title: string; url: string; snippet: string; relevance_reason: string; source_type: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sources/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: objectiveId }),
    });
    const data = await res.json();
    setSources(data.sources ?? []);
    setLoading(false);
  }, [objectiveId]);

  useEffect(() => {
    search();
  }, [search]);

  async function importSource(source: (typeof sources)[0]) {
    setImporting(source.url);
    const res = await fetch("/api/sources/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective_id: objectiveId,
        url: source.url,
        title: source.title,
        source_type: source.source_type,
      }),
    });
    const data = await res.json();
    setImporting(null);
    if (res.ok) onImported(data.id);
  }

  async function importAttentionDemo() {
    setImporting("attention-demo");
    const res = await fetch("/api/sources/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective_id: objectiveId,
        url: "https://arxiv.org/abs/1706.03762",
        title: "Attention Is All You Need",
        source_type: "paper",
      }),
    });
    const data = await res.json();
    setImporting(null);
    if (res.ok) onImported(data.id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-semibold text-amber-900">Demo: Attention Is All You Need</h2>
        <p className="mt-1 text-sm text-amber-800">
          One-click import of the Transformer paper for hackathon demos.
        </p>
        <button
          type="button"
          onClick={importAttentionDemo}
          disabled={importing === "attention-demo"}
          className="mt-3 rounded-lg bg-amber-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {importing === "attention-demo" ? "Importing…" : "Import Attention paper"}
        </button>
      </div>

      <h2 className="text-lg font-semibold text-stone-900">Discover sources</h2>
      {loading ? (
        <p className="text-stone-500">Searching…</p>
      ) : (
        <ul className="space-y-3">
          {sources.map((s) => (
            <li key={s.url} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-stone-600">{s.snippet}</p>
              <button
                type="button"
                onClick={() => importSource(s)}
                disabled={importing === s.url}
                className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {importing === s.url ? "Importing…" : "Import & read"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
