import fs from "fs";
import path from "path";
import { getTraceData } from "@/lib/repository";
import { getEventAnalytics } from "@/lib/clickhouse/client";

export async function buildTraceResponse(objectiveId: string) {
  const trace = getTraceData(objectiveId);
  if (!trace) return null;

  const analytics = await getEventAnalytics(objectiveId);

  const chain = trace.annotations.map((ann) => {
    const note = trace.notes.find((n) => n.annotation_id === ann.id);
    const card = trace.excerpt_cards.find((c) => c.annotation_id === ann.id);
    const source = trace.sources.find((s) => s.id === ann.source_id);
    return {
      source: source ? { id: source.id, title: source.title, url: source.url } : null,
      annotation: {
        id: ann.id,
        selected_text: ann.selected_text,
        semiont_annotation_id: ann.semiont_annotation_id,
      },
      excerpt_card: card ?? null,
      note: note ?? null,
    };
  });

  return {
    trace_id: trace.objective.trace_id,
    objective: trace.objective,
    chain,
    notes: trace.notes,
    excerpt_cards: trace.excerpt_cards,
    sources: trace.sources,
    annotations: trace.annotations,
    reflection: trace.reflection,
    published_post: trace.published_post,
    concepts: trace.concepts,
    events: trace.events,
    clickhouse_analytics: analytics,
  };
}
