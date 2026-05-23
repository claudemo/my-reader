"use client";

import { useEffect, useMemo, useState } from "react";
import { getSelectedTextWithContext } from "@/components/HighlightReader";
import {
  HighlightedPageText,
  type PageHighlight,
} from "@/components/pdf/HighlightedPageText";

export interface SavedHighlight {
  id: string;
  start_offset: number;
  end_offset: number;
  page_index: number | null;
  selected_text: string;
}

interface PdfReaderProps {
  workspaceId: string;
  learningObjectiveId: string | null;
  sourceId: string;
  title: string;
  pages: string[];
  sourceType: string;
  hasFile: boolean;
  savedHighlights?: SavedHighlight[];
  sources?: Array<{ id: string; title: string }>;
  onSourceChange?: (sourceId: string) => void;
  onExcerptSaved: () => void;
}

export function PdfReader({
  workspaceId,
  learningObjectiveId,
  sourceId,
  title,
  pages,
  sourceType,
  hasFile,
  savedHighlights = [],
  sources = [],
  onSourceChange,
  onExcerptSaved,
}: PdfReaderProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExcerpt, setLastExcerpt] = useState<string | null>(null);
  const [view, setView] = useState<"text" | "pdf">("text");
  const [localHighlights, setLocalHighlights] = useState<SavedHighlight[]>([]);

  useEffect(() => {
    setLocalHighlights(savedHighlights);
  }, [savedHighlights, sourceId, pageIndex]);

  const containerId = "pdf-reader-text";
  const page = pages[pageIndex] ?? pages[0] ?? "";
  const isPdf = sourceType === "pdf" && hasFile;
  const fileUrl = `/api/sources/${sourceId}/file#page=${pageIndex + 1}`;
  const pageEmpty = page.trim().length === 0;

  const pageHighlights: PageHighlight[] = useMemo(
    () =>
      localHighlights
        .filter((h) => h.page_index === pageIndex)
        .map((h) => ({
          id: h.id,
          start: h.start_offset,
          end: h.end_offset,
        })),
    [localHighlights, pageIndex]
  );

  async function saveHighlight() {
    if (!learningObjectiveId) {
      setError("Select an objective in the sidebar first.");
      return;
    }

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
          objective_id: workspaceId,
          learning_objective_id: learningObjectiveId,
          source_id: sourceId,
          selected_text: sel.selectedText,
          surrounding_context: sel.surroundingContext,
          start_offset: sel.start_offset,
          end_offset: sel.end_offset,
          page_index: pageIndex,
          user_comment: comment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save highlight");

      const saved: SavedHighlight = {
        id: data.annotation.id,
        start_offset: sel.start_offset,
        end_offset: sel.end_offset,
        page_index: pageIndex,
        selected_text: sel.selectedText,
      };
      setLocalHighlights((prev) => [...prev.filter((h) => h.id !== saved.id), saved]);
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
    <div className="flex h-full min-h-0 flex-col bg-stone-50">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reading</p>
          <h1 className="truncate text-base font-semibold text-stone-900">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sources.length > 1 && onSourceChange && (
            <select
              value={sourceId}
              onChange={(e) => onSourceChange(e.target.value)}
              className="rounded-lg border border-stone-300 px-2 py-1 text-xs"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
          {isPdf && (
            <button
              type="button"
              onClick={() => setView((v) => (v === "text" ? "pdf" : "text"))}
              className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600"
            >
              {view === "text" ? "PDF view" : "Text view"}
            </button>
          )}
          <span className="text-xs text-stone-500">
            Page {pageIndex + 1} / {Math.max(pages.length, 1)}
          </span>
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            className="rounded border border-stone-300 px-2 py-1 text-xs disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            className="rounded border border-stone-300 px-2 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "pdf" && isPdf ? (
          <iframe
            key={`${sourceId}-${pageIndex}`}
            src={fileUrl}
            title={title}
            className="h-full w-full border-0 bg-stone-200"
          />
        ) : (
          <div className="h-full overflow-y-auto px-6 py-6">
            <div
              id={containerId}
              className="mx-auto max-w-3xl select-text rounded-xl border border-stone-200 bg-white p-8 shadow-sm [&::selection]:bg-amber-300/60"
            >
              {pageEmpty ? (
                <p className="text-stone-400">
                  No extractable text on this page. Try PDF view or another page.
                </p>
              ) : (
                <HighlightedPageText text={page} highlights={pageHighlights} />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-stone-200 bg-white px-4 py-3">
        <p className="mb-2 text-[10px] text-stone-400">
          {view === "text"
            ? "Select text above — saved highlights stay marked in amber."
            : "Switch to Text view to select and highlight passages."}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional note…"
            rows={2}
            className="min-w-[200px] flex-1 rounded-lg border border-stone-300 p-2 text-sm"
          />
          <button
            type="button"
            onClick={saveHighlight}
            disabled={loading || view !== "text"}
            className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save highlight"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {lastExcerpt && (
          <p className="mt-2 text-xs text-emerald-700">
            Saved: {lastExcerpt.slice(0, 120)}
            {lastExcerpt.length > 120 ? "…" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
