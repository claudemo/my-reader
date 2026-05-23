"use client";

import { useState } from "react";
import { getSelectedTextWithContext } from "@/components/HighlightReader";

interface PdfSidePanelProps {
  objectiveId: string;
  sourceId: string;
  title: string;
  pages: string[];
  onExcerptSaved: () => void;
}

export function PdfSidePanel({
  objectiveId,
  sourceId,
  title,
  pages,
  onExcerptSaved,
}: PdfSidePanelProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExcerpt, setLastExcerpt] = useState<string | null>(null);

  const containerId = "pdf-side-content";
  const page = pages[pageIndex] ?? pages[0] ?? "";

  async function saveExcerpt() {
    const sel = getSelectedTextWithContext(containerId);
    if (!sel) {
      setError("Select text on this page first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective_id: objectiveId,
          source_id: sourceId,
          selected_text: sel.selectedText,
          surrounding_context: sel.surroundingContext,
          start_offset: sel.start_offset,
          end_offset: sel.end_offset,
          user_comment: comment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save excerpt");

      setLastExcerpt(data.excerpt_card?.key_claim ?? sel.selectedText.slice(0, 80));
      setComment("");
      window.getSelection()?.removeAllRanges();
      onExcerptSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">PDF panel</p>
        <h2 className="truncate text-sm font-semibold text-stone-900">{title}</h2>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-stone-500">
            Page {pageIndex + 1} of {pages.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              className="rounded border border-stone-300 px-2 py-0.5 text-xs disabled:opacity-40"
            >
              ◀
            </button>
            <button
              type="button"
              disabled={pageIndex >= pages.length - 1}
              onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
              className="rounded border border-stone-300 px-2 py-0.5 text-xs disabled:opacity-40"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div
          id={containerId}
          className="select-text rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm leading-relaxed text-stone-800"
        >
          {page.split("\n").map((line, i) =>
            line.trim() ? (
              <p key={i} className="mb-2">
                {line}
              </p>
            ) : null
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-stone-200 bg-white p-4">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Why does this excerpt matter?"
          rows={2}
          className="w-full rounded-lg border border-stone-300 p-2 text-xs"
        />
        <button
          type="button"
          onClick={saveExcerpt}
          disabled={loading}
          className="w-full rounded-lg bg-amber-800 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving excerpt…" : "Save highlight"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {lastExcerpt && (
          <p className="text-xs text-emerald-700">
            Saved: {lastExcerpt.slice(0, 100)}
            {lastExcerpt.length > 100 ? "…" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
