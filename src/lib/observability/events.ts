import { getDb } from "@/lib/db";
import { newId } from "@/lib/utils/ids";
import { insertReadingEvent } from "@/lib/clickhouse/client";
import type { TraceContext } from "@/lib/types";

export interface LogEventInput {
  trace_id: string;
  objective_id: string;
  event_type: string;
  object_type: string;
  object_id: string;
  agent_name?: string;
  metadata?: Record<string, unknown>;
  latency_ms?: number;
  status?: string;
  concepts?: string[];
  source_url?: string;
}

export function logStructured(entry: LogEventInput) {
  const payload = {
    trace_id: entry.trace_id,
    objective_id: entry.objective_id,
    event_type: entry.event_type,
    agent_name: entry.agent_name ?? null,
    object_id: entry.object_id,
    status: entry.status ?? "success",
    latency_ms: entry.latency_ms ?? null,
    timestamp: new Date().toISOString(),
    ...entry.metadata,
  };
  console.log(JSON.stringify(payload));
}

export async function recordEvent(entry: LogEventInput) {
  const db = getDb();
  const id = newId("evt");
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO event_logs
     (id, trace_id, objective_id, event_type, object_type, object_id, agent_name, metadata, latency_ms, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    entry.trace_id,
    entry.objective_id,
    entry.event_type,
    entry.object_type,
    entry.object_id,
    entry.agent_name ?? null,
    JSON.stringify(entry.metadata ?? {}),
    entry.latency_ms ?? null,
    entry.status ?? "success",
    now
  );

  logStructured(entry);

  await insertReadingEvent({
    event_id: id,
    trace_id: entry.trace_id,
    objective_id: entry.objective_id,
    event_type: entry.event_type,
    object_type: entry.object_type,
    object_id: entry.object_id,
    agent_name: entry.agent_name,
    concepts: entry.concepts,
    source_url: entry.source_url,
    latency_ms: entry.latency_ms,
    status: entry.status ?? "success",
    metadata: entry.metadata,
  });
}

export function getTraceIdForObjective(objectiveId: string): string | null {
  const row = getDb()
    .prepare("SELECT trace_id FROM objectives WHERE id = ?")
    .get(objectiveId) as { trace_id: string } | undefined;
  return row?.trace_id ?? null;
}

export function withTiming<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; latency_ms: number }> {
  const start = Date.now();
  return Promise.resolve(fn()).then((result) => ({
    result,
    latency_ms: Date.now() - start,
  }));
}

export function ctxFromObjective(
  objectiveId: string,
  traceId: string,
  extra?: Partial<TraceContext>
): TraceContext {
  return { trace_id: traceId, objective_id: objectiveId, ...extra };
}
