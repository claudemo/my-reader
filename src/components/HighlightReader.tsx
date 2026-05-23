"use client";

import { useCallback, useState } from "react";

function textOffsetInContainer(
  container: Node,
  targetNode: Node,
  targetOffset: number
): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node === targetNode) return cursor + targetOffset;
    cursor += node.textContent?.length ?? 0;
  }
  return null;
}

export function getSelectedTextWithContext(containerId: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const container = document.getElementById(containerId);
  if (!container) return null;

  const fullText = container.textContent ?? "";
  const start = textOffsetInContainer(container, range.startContainer, range.startOffset);
  const end = textOffsetInContainer(container, range.endContainer, range.endOffset);

  let selectedText = selection.toString();
  let start_offset = 0;
  let end_offset = selectedText.length;

  if (start !== null && end !== null && end > start) {
    selectedText = fullText.slice(start, end);
    start_offset = start;
    end_offset = end;
  } else if (!selectedText.trim()) {
    return null;
  } else {
    const idx = fullText.indexOf(selectedText);
    if (idx >= 0) {
      start_offset = idx;
      end_offset = idx + selectedText.length;
    }
  }

  if (!selectedText.trim()) return null;

  const contextRadius = 240;
  const contextStart = Math.max(0, start_offset - contextRadius);
  const contextEnd = Math.min(fullText.length, end_offset + contextRadius);
  const surroundingContext = fullText.slice(contextStart, contextEnd).trim();

  return {
    selectedText: selectedText.trim(),
    surroundingContext: surroundingContext || selectedText.trim(),
    start_offset,
    end_offset,
  };
}

interface HighlightReaderProps {
  sourceId: string;
  objectiveId: string;
  title: string;
  sections: string[];
  onHighlightSaved?: (payload: unknown) => void;
}

export function HighlightReader({
  sourceId,
  objectiveId,
  title,
  sections,
  onHighlightSaved,
}: HighlightReaderProps) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastCard, setLastCard] = useState<{
    excerpt_card?: { key_claim: string; relevance_to_objective: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ text: string; motivation: string }>
  >([]);

  const section = sections[sectionIndex] ?? sections[0] ?? "";
  const containerId = "reader-content";

  const saveHighlight = useCallback(async () => {
    const sel = getSelectedTextWithContext(containerId);
    if (!sel) {
      setError("Select text in the reader first.");
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
      if (!res.ok) throw new Error(data.error ?? "Failed to save highlight");
      setLastCard(data);
      setComment("");
      onHighlightSaved?.(data);
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }, [comment, objectiveId, onHighlightSaved, sourceId]);

  async function loadSemiontSuggestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/semiont/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setError("Could not load Semiont suggestions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <article className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Reading</p>
            <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
            <p className="text-sm text-stone-500">
              Section {sectionIndex + 1} of {sections.length} · Karpathy-style chapter reader
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={sectionIndex === 0}
              onClick={() => setSectionIndex((i) => Math.max(0, i - 1))}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={sectionIndex >= sections.length - 1}
              onClick={() => setSectionIndex((i) => Math.min(sections.length - 1, i + 1))}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div
          id={containerId}
          className="prose prose-stone max-w-none select-text leading-relaxed text-stone-800"
        >
          {section.split("\n").map((line, i) => {
            if (line.startsWith("# ")) {
              return (
                <h2 key={i} className="mb-3 mt-6 text-lg font-semibold">
                  {line.slice(2)}
                </h2>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <h3 key={i} className="mb-2 mt-4 text-base font-semibold">
                  {line.slice(3)}
                </h3>
              );
            }
            if (!line.trim()) return <br key={i} />;
            return (
              <p key={i} className="mb-3">
                {line}
              </p>
            );
          })}
        </div>
      </article>

      <aside className="space-y-4">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Highlight → Annotation</h2>
          <p className="mb-3 text-sm text-stone-600">
            Select a passage, add an optional note, then save. Semiont-style W3C annotations sync
            when <code className="text-xs">SEMIONT_BASE_URL</code> is configured.
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Why does this matter to your objective?"
            className="mb-3 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm"
            rows={3}
          />
          <button
            type="button"
            onClick={saveHighlight}
            disabled={loading}
            className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? "Generating note…" : "Save highlight & generate note"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-violet-900">Semiont assist</h2>
          <p className="mb-3 text-xs text-violet-800">
            AI-assisted marking (Semiont MARK flow) proposes passages worth annotating.
          </p>
          <button
            type="button"
            onClick={loadSemiontSuggestions}
            disabled={loading}
            className="mb-3 w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            Suggest highlights
          </button>
          <ul className="space-y-2 text-xs text-violet-900">
            {suggestions.map((s) => (
              <li key={s.text} className="rounded bg-white/70 p-2">
                <span className="font-medium">{s.motivation}:</span> {s.text.slice(0, 120)}…
              </li>
            ))}
          </ul>
        </div>

        {lastCard?.excerpt_card && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="mb-1 font-semibold text-emerald-900">Excerpt Card</p>
            <p className="text-emerald-800">{lastCard.excerpt_card.key_claim}</p>
            <p className="mt-2 text-emerald-700">
              {lastCard.excerpt_card.relevance_to_objective}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
