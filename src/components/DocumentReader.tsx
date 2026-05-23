"use client";

import { useState } from "react";

interface DocumentReaderProps {
  sourceId: string;
  objectiveId: string;
  title: string;
  sections: string[];
  sources: Array<{ id: string; title: string }>;
  activeSourceId: string;
  onSourceChange: (id: string) => void;
  onHighlightSaved?: () => void;
}

export function DocumentReader({
  sourceId,
  objectiveId,
  title,
  sections,
  sources,
  activeSourceId,
  onSourceChange,
  onHighlightSaved,
}: DocumentReaderProps) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const section = sections[sectionIndex] ?? sections[0] ?? "";
  const containerId = "reader-content";

  return (
    <article className="mx-auto max-w-3xl rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-6 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Document</p>
            <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
            <p className="text-sm text-stone-500">
              Section {sectionIndex + 1} of {sections.length}
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
        {sources.length > 1 && (
          <select
            value={activeSourceId}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="px-6 py-6">
        <div
          id={containerId}
          className="prose prose-stone max-w-none select-text leading-relaxed text-stone-800"
        >
          {section.split("\n").map((line, i) => {
            if (line.startsWith("# ")) {
              return (
                <h2 key={i} className="mb-3 mt-2 text-lg font-semibold">
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
      </div>

      <div className="border-t border-stone-100 bg-stone-50 px-6 py-3 text-xs text-stone-500">
        Select text, then use the <strong>Annotations</strong> side tab to save Semiont highlights.
      </div>
    </article>
  );
}
