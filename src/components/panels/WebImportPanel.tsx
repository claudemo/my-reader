"use client";

import { useState } from "react";

export function WebImportPanel({
  objectiveId,
  onImported,
  compact = false,
}: {
  objectiveId: string;
  onImported?: (result: {
    sourceId: string;
    objectiveId: string;
    pageCount?: number;
    fromCache?: boolean;
  }) => void;
  compact?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function pullFromWeb(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/sources/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective_id: objectiveId, url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      const pageCount = data.page_count as number | undefined;
      const fromCache = Boolean(data.from_cache);
      setSuccess(
        pageCount
          ? `Imported ${pageCount} page${pageCount === 1 ? "" : "s"}${fromCache ? " (from cache)" : ""}.`
          : "Imported."
      );
      onImported?.({
        sourceId: data.id,
        objectiveId,
        pageCount,
        fromCache,
      });
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={pullFromWeb} className={compact ? "space-y-2" : "space-y-3"}>
      {!compact && (
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Pull from website</h3>
          <p className="mt-1 text-xs text-stone-600">
            Paste an article or paper URL. arXiv links fetch the full PDF. Parsed text is saved to
            your reading session and cached for reuse.
          </p>
        </div>
      )}
      {compact && (
        <p className="text-xs font-medium text-stone-700">Or pull from a URL</p>
      )}
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://arxiv.org/abs/1706.03762"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="w-full rounded-lg border border-stone-300 bg-white py-2 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
      >
        {loading ? "Extracting text…" : "Pull from website"}
      </button>
      {success && <p className="text-xs text-emerald-700">{success}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
