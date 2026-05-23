"use client";

import type { LearningObjective } from "@/lib/types/learning-objective";

export function SidePanelObjective({
  objectives,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  hasBook,
}: {
  objectives: LearningObjective[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  hasBook: boolean;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Objectives
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium text-violet-800 hover:underline"
        >
          + Add
        </button>
      </div>

      {objectives.length === 0 ? (
        <p className="text-xs text-stone-500">
          Add an objective, then open <strong>Map</strong> to generate its reading path.
        </p>
      ) : (
        <ul className="space-y-2">
          {objectives.map((o) => {
            const active = o.id === activeId;
            const label = o.description.trim() || o.title;
            return (
              <li
                key={o.id}
                className={`rounded-lg border p-3 ${
                  active
                    ? "border-amber-300 bg-amber-50"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(o.id)}
                  className="w-full text-left"
                >
                  <p className="line-clamp-2 text-sm font-medium text-stone-900">{label}</p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {o.has_map ? "Map ready" : "No map yet"}
                  </p>
                </button>
                {objectives.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDelete(o.id)}
                    className="mt-2 text-[10px] text-stone-400 hover:text-stone-600"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasBook && (
        <p className="text-[11px] text-stone-500">
          One document per reading session. Switch objectives to focus notes and maps.
        </p>
      )}
    </div>
  );
}
