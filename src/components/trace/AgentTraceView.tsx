"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityTraceResponse, ParsedActivityEvent } from "@/lib/types/activity-trace";
import type { LearningObjective } from "@/lib/types/learning-objective";

function ClickHouseBanner() {
  const [status, setStatus] = useState<{
    connected: boolean;
    database: string;
    reading_events: number;
    parsed_doc_cache: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/clickhouse/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        status.connected
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : "border-stone-200 bg-stone-50 text-stone-600"
      }`}
    >
      <p className="font-medium">
        ClickHouse {status.connected ? "connected" : "offline"}
      </p>
      {status.connected ? (
        <>
          <p className="mt-1 font-mono text-[10px] opacity-80">database: {status.database}</p>
          <p className="mt-1">
            {status.reading_events} events · {status.parsed_doc_cache} parsed docs cached
          </p>
        </>
      ) : (
        <p className="mt-1">Start ClickHouse with npm run clickhouse:up if needed.</p>
      )}
    </div>
  );
}

function LapdogBanner() {
  const [status, setStatus] = useState<{
    enabled: boolean;
    connected: boolean;
    local_id: string;
    dashboard_url: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/lapdog/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        status.connected
          ? "border-violet-200 bg-violet-50 text-violet-900"
          : "border-stone-200 bg-stone-50 text-stone-600"
      }`}
    >
      <p className="font-medium">
        Datadog Lapdog {status.connected ? "connected" : status.enabled ? "enabled (agent offline)" : "off"}
      </p>
      <p className="mt-1 font-mono text-[10px] opacity-80">local id: {status.local_id}</p>
      <p className="mt-1">
        {status.connected
          ? "LLM calls and agent spans stream to the Lapdog dashboard."
          : "Run npm run lapdog:start then npm run dev:lapdog for live LLM traces."}
      </p>
      {status.connected && (
        <a
          href={status.dashboard_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-medium text-violet-800 hover:underline"
        >
          Open Lapdog dashboard →
        </a>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function agentBadgeClass(agent: string | null) {
  if (!agent) return "bg-stone-100 text-stone-600";
  if (agent.includes("Map")) return "bg-violet-100 text-violet-800";
  if (agent.includes("Source")) return "bg-sky-100 text-sky-800";
  if (agent.includes("Annotation") || agent.includes("Note")) return "bg-amber-100 text-amber-900";
  if (agent.includes("Reflection")) return "bg-emerald-100 text-emerald-800";
  if (agent.includes("Publish")) return "bg-stone-800 text-white";
  if (agent.includes("Semiont")) return "bg-indigo-100 text-indigo-800";
  return "bg-stone-100 text-stone-700";
}

function metadataSummary(event: ParsedActivityEvent) {
  const parts: string[] = [];
  const m = event.metadata;
  if (typeof m.filename === "string") parts.push(m.filename);
  if (typeof m.pages === "number") parts.push(`${m.pages} pages`);
  if (typeof m.generator === "string") parts.push(`via ${m.generator}`);
  if (typeof m.steps === "number") parts.push(`${m.steps} steps`);
  if (typeof m.count === "number") parts.push(`${m.count} results`);
  if (typeof m.provider === "string") parts.push(m.provider);
  if (typeof m.semiont_synced === "boolean") {
    parts.push(m.semiont_synced ? "Semiont synced" : "Semiont offline");
  }
  return parts.join(" · ");
}

function EventRow({ event, objectiveLabel }: { event: ParsedActivityEvent; objectiveLabel?: string }) {
  const detail = metadataSummary(event);

  return (
    <li className="relative border-l-2 border-stone-200 pl-4 pb-5 last:pb-0">
      <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-amber-600" />
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${agentBadgeClass(event.agent_name)}`}>
          {event.agent_name ?? "System"}
        </span>
        <span className="text-[11px] text-stone-400">{formatTime(event.created_at)}</span>
        {event.latency_ms != null && event.latency_ms > 0 && (
          <span className="text-[11px] text-stone-400">{event.latency_ms}ms</span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-stone-900">{event.label}</p>
      {objectiveLabel && (
        <p className="mt-0.5 text-[11px] text-stone-500">Objective: {objectiveLabel}</p>
      )}
      {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
      <p className="mt-1 font-mono text-[10px] text-stone-400">
        {event.object_type}/{event.object_id.slice(0, 12)}… · {event.status}
      </p>
    </li>
  );
}

export function AgentTraceView({
  workspaceId,
  learningObjectiveId = null,
  learningObjectives = [],
  compact = false,
}: {
  workspaceId: string;
  learningObjectiveId?: string | null;
  learningObjectives?: LearningObjective[];
  compact?: boolean;
}) {
  const [trace, setTrace] = useState<ActivityTraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (learningObjectiveId) params.set("learning_objective_id", learningObjectiveId);
      const query = params.toString();
      const res = await fetch(
        `/api/trace/${workspaceId}/activity${query ? `?${query}` : ""}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load trace");
      setTrace(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trace");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, learningObjectiveId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-stone-500">Loading agent trace…</p>;
  }

  if (error || !trace) {
    return <p className="text-sm text-red-600">{error ?? "Trace unavailable"}</p>;
  }

  const objectiveLabels = new Map(
    learningObjectives.map((o) => [o.id, o.description.trim() || o.title])
  );

  return (
    <div className={compact ? "space-y-4" : "h-full overflow-y-auto px-6 py-6"}>
      <div className={compact ? "space-y-2" : "mx-auto max-w-3xl space-y-6"}>
        <div>
          <ClickHouseBanner />
          <LapdogBanner />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Agent activity
          </p>
          {!compact && (
            <h1 className="mt-1 text-2xl font-semibold text-stone-900">Reading trace</h1>
          )}
          <p className="mt-1 font-mono text-[11px] text-stone-500">trace_id: {trace.trace_id}</p>
          <p className="text-xs text-stone-500">
            {trace.summary.total} events across {Object.keys(trace.summary.by_agent).length} agents
          </p>
        </div>

        {!compact && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(trace.summary.by_agent).map(([agent, count]) => (
              <div key={agent} className="rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-stone-400">{agent}</p>
                <p className="text-lg font-semibold text-stone-900">{count}</p>
              </div>
            ))}
          </div>
        )}

        {trace.events.length === 0 ? (
          <p className="text-sm text-stone-500">
            No agent activity yet. Generate a map, upload a source, or save a highlight.
          </p>
        ) : (
          <ol className="space-y-0">
            {trace.events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                objectiveLabel={
                  event.learning_objective_id
                    ? objectiveLabels.get(event.learning_objective_id)
                    : undefined
                }
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function AgentTraceSidebar({
  traceId,
  summary,
  learningObjectives,
  filterId,
  onFilterChange,
}: {
  traceId: string;
  summary: { total: number; by_agent: Record<string, number> } | null;
  learningObjectives: LearningObjective[];
  filterId: string | null;
  onFilterChange: (id: string | null) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Trace</p>
        <p className="mt-1 font-mono text-[10px] text-stone-500 break-all">{traceId}</p>
      </div>

      <div>
        <label htmlFor="trace-filter" className="text-xs font-medium text-stone-600">
          Filter by objective
        </label>
        <select
          id="trace-filter"
          value={filterId ?? ""}
          onChange={(e) => onFilterChange(e.target.value || null)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
        >
          <option value="">All activity</option>
          {learningObjectives.map((o) => (
            <option key={o.id} value={o.id}>
              {o.description.trim() || o.title}
            </option>
          ))}
        </select>
      </div>

      {summary && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs font-medium text-stone-700">{summary.total} events</p>
          <ul className="mt-2 space-y-1">
            {Object.entries(summary.by_agent).map(([agent, count]) => (
              <li key={agent} className="flex justify-between text-[11px] text-stone-600">
                <span>{agent}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-stone-500">
        Every agent step in this reading session is logged here — map generation, uploads, highlights,
        and more.
      </p>
    </div>
  );
}
