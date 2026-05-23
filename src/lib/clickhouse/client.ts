import { createClient, ClickHouseClient } from "@clickhouse/client";
import type { TraceContext } from "@/lib/types";
import type { EventLog } from "@/lib/types";
import type { PdfExtraction } from "@/lib/pdf/extract";

let client: ClickHouseClient | null = null;
let clickhouseAvailable: boolean | null = null;
let lastPingAt = 0;

const PING_INTERVAL_MS = 30_000;

function getDatabaseName(): string {
  return process.env.CLICKHOUSE_DATABASE ?? "myreader";
}

function getClient(): ClickHouseClient {
  if (!client) {
    const url = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
    client = createClient({
      url,
      username: process.env.CLICKHOUSE_USER ?? "default",
      password: process.env.CLICKHOUSE_PASSWORD ?? "",
      database: getDatabaseName(),
    });
  }
  return client;
}

function markUnavailable() {
  clickhouseAvailable = false;
  lastPingAt = Date.now();
}

function markAvailable() {
  clickhouseAvailable = true;
  lastPingAt = Date.now();
}

export interface ReadingEventPayload {
  event_id?: string;
  trace_id: string;
  objective_id: string;
  event_type: string;
  object_type: string;
  object_id: string;
  agent_name?: string;
  concepts?: string[];
  source_url?: string;
  latency_ms?: number;
  status: string;
  metadata?: Record<string, unknown>;
}

export async function insertReadingEvent(
  payload: ReadingEventPayload
): Promise<boolean> {
  const ch = getClient();

  try {
    await ch.insert({
      table: "reading_events",
      values: [
        {
          event_id: payload.event_id ?? payload.object_id,
          trace_id: payload.trace_id,
          objective_id: payload.objective_id,
          event_type: payload.event_type,
          object_type: payload.object_type,
          object_id: payload.object_id,
          agent_name: payload.agent_name ?? "",
          concepts: payload.concepts ?? [],
          source_url: payload.source_url ?? "",
          latency_ms: payload.latency_ms ?? 0,
          status: payload.status,
          metadata: JSON.stringify(payload.metadata ?? {}),
        },
      ],
      format: "JSONEachRow",
    });
    markAvailable();
    return true;
  } catch {
    markUnavailable();
    return false;
  }
}

export async function listReadingEvents(objectiveId: string): Promise<EventLog[]> {
  const ch = getClient();

  try {
    const result = await ch.query({
      query: `
        SELECT
          event_id AS id,
          trace_id,
          objective_id,
          event_type,
          object_type,
          object_id,
          nullIf(agent_name, '') AS agent_name,
          metadata,
          latency_ms,
          status,
          formatDateTime(created_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS created_at
        FROM reading_events
        WHERE objective_id = {objectiveId:String}
        ORDER BY created_at ASC
      `,
      query_params: { objectiveId },
      format: "JSONEachRow",
    });

    const rows = await result.json<{
      id: string;
      trace_id: string;
      objective_id: string;
      event_type: string;
      object_type: string;
      object_id: string;
      agent_name: string | null;
      metadata: string;
      latency_ms: number | null;
      status: string;
      created_at: string;
    }>();

    markAvailable();
    return rows.map((row) => ({
      id: row.id,
      trace_id: row.trace_id,
      objective_id: row.objective_id,
      event_type: row.event_type,
      object_type: row.object_type,
      object_id: row.object_id,
      agent_name: row.agent_name,
      metadata: row.metadata || "{}",
      latency_ms: row.latency_ms,
      status: row.status,
      created_at: row.created_at,
    }));
  } catch {
    markUnavailable();
    return [];
  }
}

export async function upsertParsedDocCache(
  extraction: PdfExtraction,
  meta: {
    cacheKey: string;
    canonicalUrl?: string | null;
    sourceType: "pdf" | "text" | "web";
    extractionVersion: number;
  }
): Promise<boolean> {
  const ch = getClient();

  try {
    await ch.insert({
      table: "parsed_doc_cache",
      values: [
        {
          cache_key: meta.cacheKey,
          canonical_url: meta.canonicalUrl ?? null,
          source_type: meta.sourceType,
          text: extraction.text,
          page_offsets: JSON.stringify(extraction.pageOffsets),
          total_pages: extraction.totalPages,
          doc_title: extraction.title,
          doc_author: extraction.author,
          byte_size: extraction.byteSize,
          extraction_version: meta.extractionVersion,
        },
      ],
      format: "JSONEachRow",
    });
    markAvailable();
    return true;
  } catch {
    markUnavailable();
    return false;
  }
}

export async function getParsedDocCache(cacheKey: string): Promise<PdfExtraction | null> {
  const ch = getClient();

  try {
    const result = await ch.query({
      query: `
        SELECT *
        FROM parsed_doc_cache
        WHERE cache_key = {cacheKey:String}
        ORDER BY created_at DESC
        LIMIT 1
      `,
      query_params: { cacheKey },
      format: "JSONEachRow",
    });

    const rows = await result.json<{
      cache_key: string;
      text: string;
      page_offsets: string;
      total_pages: number;
      doc_title: string;
      doc_author: string;
      byte_size: number;
    }>();

    const row = rows[0];
    if (!row) return null;

    markAvailable();
    return {
      text: row.text,
      pages: [],
      totalPages: row.total_pages,
      title: row.doc_title,
      author: row.doc_author,
      contentHash: row.cache_key,
      byteSize: Number(row.byte_size),
      pageOffsets: JSON.parse(row.page_offsets) as number[],
    };
  } catch {
    markUnavailable();
    return null;
  }
}

export async function getParsedDocCacheByUrl(canonicalUrl: string): Promise<PdfExtraction | null> {
  const ch = getClient();

  try {
    const result = await ch.query({
      query: `
        SELECT *
        FROM parsed_doc_cache
        WHERE canonical_url = {canonicalUrl:String}
        ORDER BY created_at DESC
        LIMIT 1
      `,
      query_params: { canonicalUrl },
      format: "JSONEachRow",
    });

    const rows = await result.json<{
      cache_key: string;
      text: string;
      page_offsets: string;
      total_pages: number;
      doc_title: string;
      doc_author: string;
      byte_size: number;
    }>();

    const row = rows[0];
    if (!row) return null;

    markAvailable();
    return {
      text: row.text,
      pages: [],
      totalPages: row.total_pages,
      title: row.doc_title,
      author: row.doc_author,
      contentHash: row.cache_key,
      byteSize: Number(row.byte_size),
      pageOffsets: JSON.parse(row.page_offsets) as number[],
    };
  } catch {
    markUnavailable();
    return null;
  }
}

export async function getEventAnalytics(objectiveId: string) {
  const ch = getClient();

  try {
    const byType = await ch.query({
      query: `
        SELECT event_type, count() AS count
        FROM reading_events
        WHERE objective_id = {objectiveId:String}
        GROUP BY event_type
        ORDER BY count DESC
      `,
      query_params: { objectiveId },
      format: "JSONEachRow",
    });
    const byConcept = await ch.query({
      query: `
        SELECT concept, count() AS count
        FROM reading_events
        ARRAY JOIN concepts AS concept
        WHERE objective_id = {objectiveId:String}
        GROUP BY concept
        ORDER BY count DESC
        LIMIT 20
      `,
      query_params: { objectiveId },
      format: "JSONEachRow",
    });

    markAvailable();
    return {
      by_event_type: await byType.json<{ event_type: string; count: string }>(),
      by_concept: await byConcept.json<{ concept: string; count: string }>(),
    };
  } catch {
    markUnavailable();
    return null;
  }
}

export async function pingClickHouse(): Promise<boolean> {
  if (clickhouseAvailable === false && Date.now() - lastPingAt < PING_INTERVAL_MS) {
    return false;
  }

  try {
    await getClient().ping();
    markAvailable();
    return true;
  } catch {
    markUnavailable();
    return false;
  }
}

export async function getClickHouseStatus() {
  const connected = await pingClickHouse();
  if (!connected) {
    return {
      connected: false,
      database: getDatabaseName(),
      reading_events: 0,
      parsed_doc_cache: 0,
    };
  }

  const ch = getClient();
  try {
    const events = await ch.query({
      query: "SELECT count() AS count FROM reading_events",
      format: "JSONEachRow",
    });
    const docs = await ch.query({
      query: "SELECT count() AS count FROM parsed_doc_cache",
      format: "JSONEachRow",
    });
    const eventRows = await events.json<{ count: string }>();
    const docRows = await docs.json<{ count: string }>();

    return {
      connected: true,
      database: getDatabaseName(),
      reading_events: Number(eventRows[0]?.count ?? 0),
      parsed_doc_cache: Number(docRows[0]?.count ?? 0),
    };
  } catch {
    markUnavailable();
    return {
      connected: false,
      database: getDatabaseName(),
      reading_events: 0,
      parsed_doc_cache: 0,
    };
  }
}

export function buildEventFromContext(
  ctx: TraceContext,
  partial: Omit<ReadingEventPayload, "trace_id" | "objective_id">
): ReadingEventPayload {
  return {
    trace_id: ctx.trace_id,
    objective_id: ctx.objective_id ?? partial.object_id,
    ...partial,
  };
}

export async function hydrateParsedExtraction(extraction: PdfExtraction): Promise<PdfExtraction> {
  if (extraction.pages.length > 0) return extraction;
  const { slicePagesFromText } = await import("@/lib/pdf/extract");
  const pages = slicePagesFromText(
    extraction.text,
    JSON.stringify(extraction.pageOffsets),
    extraction.totalPages
  );
  return { ...extraction, pages: pages.length ? pages : [extraction.text] };
}
