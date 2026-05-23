"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReadingMapStep, ReadingPath } from "@/lib/types/reading-map";
import { UploadPanel } from "@/components/panels/UploadPanel";
import { WebImportPanel } from "@/components/panels/WebImportPanel";

function MapStepCard({ step }: { step: ReadingMapStep }) {
  return (
    <li className="rounded-lg border border-stone-200 bg-stone-50 p-2 text-xs">
      <span className="font-semibold text-stone-900">
        {step.order}. {step.title}
      </span>
      <p className="mt-1 text-stone-600">{step.description}</p>
      {step.focus_question && (
        <p className="mt-2 text-[11px] text-violet-800">
          <span className="font-medium">Ask:</span> {step.focus_question}
        </p>
      )}
      {step.look_for && step.look_for.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Look for
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-stone-700">
            {step.look_for.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
      {step.document_targets && step.document_targets.length > 0 && (
        <div className="mt-2 space-y-1">
          {step.document_targets.map((target) => (
            <div
              key={`${target.source_title}-${target.page_index}-${target.excerpt_hint.slice(0, 24)}`}
              className="rounded border border-amber-100 bg-amber-50/70 p-2 text-[11px] text-stone-700"
            >
              <p className="font-medium text-stone-900">
                {target.source_title}
                {target.page_index != null ? ` · page ${target.page_index + 1}` : ""}
              </p>
              <p className="mt-1 italic">&ldquo;{target.excerpt_hint}&rdquo;</p>
              <p className="mt-1 text-stone-500">{target.why}</p>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function ReadingMapPanel({
  workspaceId,
  learningObjectiveId,
  initialObjective = "",
  hasBook,
  sourceVersion = 0,
  onUploaded,
  onObjectiveSaved,
}: {
  workspaceId: string;
  learningObjectiveId: string | null;
  initialObjective?: string;
  hasBook: boolean;
  sourceVersion?: number;
  onUploaded?: (result: { sourceId: string; objectiveId: string }) => void;
  onObjectiveSaved?: () => void;
}) {
  const [userObjective, setUserObjective] = useState(initialObjective);
  const [path, setPath] = useState<ReadingPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learningObjectiveId) {
      setPath(null);
      setUserObjective(initialObjective);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reading-map/${learningObjectiveId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load reading map");
      setPath(data.reading_map ?? null);
      if (data.learning_objective?.description) {
        setUserObjective(data.learning_objective.description);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [learningObjectiveId, initialObjective]);

  useEffect(() => {
    load();
  }, [load, sourceVersion]);

  async function generate() {
    if (!learningObjectiveId) {
      setError("Add and select an objective first.");
      return;
    }
    if (!userObjective.trim()) {
      setError("Describe what you want to learn first.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/reading-map/${learningObjectiveId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_objective: userObjective.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setPath(data.reading_map);
      onObjectiveSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  if (!learningObjectiveId) {
    return (
      <p className="text-xs text-stone-500">
        Add an objective in the <strong>Objectives</strong> tab, then generate its map here.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-stone-500">Loading map…</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Map</p>
        <p className="mt-1 text-[11px] text-stone-500">
          {hasBook
            ? "The agent reads your uploaded document and extracts the parts to focus on."
            : "Add a source first, then generate a document-aware reading map."}
        </p>
      </div>

      <textarea
        value={userObjective}
        onChange={(e) => setUserObjective(e.target.value)}
        rows={4}
        placeholder="What do you want to learn from this reading?"
        className="w-full rounded-lg border border-stone-300 p-2 text-sm"
      />

      <button
        type="button"
        onClick={generate}
        disabled={generating || !userObjective.trim()}
        className="w-full rounded-lg bg-violet-800 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
      >
        {generating ? "Analyzing document…" : path ? "Regenerate map" : "Generate map"}
      </button>

      {path && (
        <ol className="space-y-2">
          {path.steps.map((step: ReadingMapStep) => (
            <MapStepCard key={step.order} step={step} />
          ))}
        </ol>
      )}

      {!hasBook && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-medium text-amber-950">No book yet</p>
          <p className="text-[11px] text-amber-900/80">
            Upload in the reader panel on the left, or add a source here.
          </p>
          <UploadPanel objectiveId={workspaceId} compact onUploaded={onUploaded} />
          <WebImportPanel objectiveId={workspaceId} compact onImported={onUploaded} />
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
