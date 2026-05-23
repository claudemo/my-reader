"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AgentTraceSidebar, AgentTraceView } from "@/components/trace/AgentTraceView";
import type { LearningObjective } from "@/lib/types/learning-objective";

export default function TracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: workspaceId } = use(params);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [traceId, setTraceId] = useState("");
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([]);

  useEffect(() => {
    fetch(`/api/objectives/${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        setTraceId(data.objective?.trace_id ?? "");
        setLearningObjectives(data.learning_objectives ?? []);
      });
  }, [workspaceId]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-stone-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 font-semibold text-stone-900">
            MyReader
          </Link>
          <span className="hidden text-stone-300 sm:inline">/</span>
          <p className="truncate text-sm text-stone-600">Agent activity trace</p>
        </div>
        <Link
          href={`/objectives/${workspaceId}`}
          className="shrink-0 text-sm text-amber-800 hover:underline"
        >
          ← Back to reader
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-hidden bg-stone-50">
          <AgentTraceView
            workspaceId={workspaceId}
            learningObjectiveId={filterId}
            learningObjectives={learningObjectives}
          />
        </main>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-stone-200 bg-white p-4 xl:w-80">
          <AgentTraceSidebar
            traceId={traceId}
            summary={null}
            learningObjectives={learningObjectives}
            filterId={filterId}
            onFilterChange={setFilterId}
          />
        </aside>
      </div>
    </div>
  );
}
