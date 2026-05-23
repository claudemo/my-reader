"use client";

import { useEffect, useState } from "react";
import { getSelectedTextWithContext } from "@/components/HighlightReader";

interface SemiontStatus {
  mode: "live" | "local-only";
  message: string;
  reachable: boolean;
}

export function SidePanelAnnotations({
  objectiveId,
  sourceId,
  annotations,
  onSaved,
}: {
  objectiveId: string;
  sourceId: string | null;
  annotations: Array<{
    id: string;
    selected_text: string;
    semiont_annotation_id: string | null;
    user_comment: string | null;
  }>;
  onSaved: () => void;
  onSuggest?: () => void;
}) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ text: string; motivation: string }>
  >([]);
  const [semiontStatus, setSemiontStatus] = useState<SemiontStatus | null>(null);

  useEffect(() => {
    fetch("/api/semiont/status")
      .then((r) => r.json())
      .then(setSemiontStatus);
  }, []);

  async function saveAnnotation() {
    if (!sourceId) {
      setError("Import a source first.");
      return;
    }
    const sel = getSelectedTextWithContext("reader-content");
    if (!sel) {
      setError("Select text in the document (Read view).");
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
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setComment("");
      window.getSelection()?.removeAllRanges();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadSemiontSuggestions() {
    if (!sourceId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/semiont/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div
        className={`rounded-lg border p-3 ${
          semiontStatus?.mode === "live"
            ? "border-emerald-200 bg-emerald-50"
            : "border-violet-200 bg-violet-50"
        }`}
      >
        <p className="text-xs font-semibold uppercase text-stone-700">
          Semiont: {semiontStatus?.mode === "live" ? "Live sync" : "Local mode"}
        </p>
        <p className="mt-1 text-xs text-stone-600">
          {semiontStatus?.message ??
            "Highlights are saved as annotations locally. Connect Semiont to sync to a shared knowledge graph."}
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
        <p className="font-medium text-stone-800">How this works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Go to <strong>Read</strong> and select text in the document.</li>
          <li>Add an optional note below.</li>
          <li>Click save — MyReader creates an annotation, excerpt card, and note.</li>
          <li>If Semiont is running, the same highlight syncs there too.</li>
        </ol>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Why does this passage matter?"
        rows={3}
        className="w-full rounded-lg border border-stone-300 p-2 text-sm"
      />
      <button
        type="button"
        onClick={saveAnnotation}
        disabled={loading || !sourceId}
        className="w-full rounded-lg bg-stone-900 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save highlight → Semiont annotation"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={loadSemiontSuggestions}
        disabled={loading || !sourceId}
        className="w-full rounded-lg border border-violet-300 py-2 text-xs text-violet-900 hover:bg-violet-50 disabled:opacity-50"
      >
        Semiont: suggest highlights
      </button>

      {suggestions.length > 0 && (
        <ul className="space-y-2 text-xs">
          {suggestions.map((s) => (
            <li key={s.text} className="rounded bg-violet-50 p-2 text-violet-900">
              <span className="font-medium">{s.motivation}</span>: {s.text.slice(0, 100)}…
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-stone-400">
          Annotation graph ({annotations.length})
        </p>
        {annotations.length === 0 ? (
          <p className="text-xs text-stone-500">No annotations yet.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {annotations.map((a) => (
              <li key={a.id} className="rounded border border-stone-100 p-2 text-xs">
                <p className="line-clamp-2 text-stone-700">&ldquo;{a.selected_text}&rdquo;</p>
                {a.semiont_annotation_id && (
                  <p className="mt-1 font-mono text-[10px] text-violet-600">
                    semiont:{a.semiont_annotation_id.slice(0, 20)}…
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
