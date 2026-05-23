import { getEventAnalytics, listReadingEvents, pingClickHouse } from "@/lib/clickhouse/client";
import {
  getExcerptCardByAnnotation,
  getObjective,
  listAnnotationsForObjective,
  listEventsForObjective,
  listLearningObjectivesForWorkspace,
} from "@/lib/repository";
import type { EventLog } from "@/lib/types";
import type {
  ActivityTraceResponse,
  ParsedActivityEvent,
} from "@/lib/types/activity-trace";

export type { ActivityTraceResponse, ParsedActivityEvent };

const EVENT_LABELS: Record<string, string> = {
  workspace_created: "Reading session started",
  reading_map_generated: "Reading map generated",
  sources_searched: "Sources searched",
  source_imported: "Source imported from web",
  source_uploaded: "PDF uploaded",
  highlight_saved: "Highlight saved",
  excerpt_card_generated: "Excerpt card generated",
  semiont_suggestions: "Semiont suggestions fetched",
  reflection_prompts_generated: "Reflection prompts generated",
  reflection_saved: "Reflection saved",
  post_published: "Post published",
  notes_exported: "Notes exported as Markdown",
};

function parseMetadata(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function resolveLearningObjectiveId(
  event: EventLog,
  metadata: Record<string, unknown>,
  annotationObjectiveById: Map<string, string | null>,
  cardToAnnotation: Map<string, string>
): string | null {
  if (typeof metadata.learning_objective_id === "string") {
    return metadata.learning_objective_id;
  }
  if (event.object_type === "annotation") {
    return annotationObjectiveById.get(event.object_id) ?? null;
  }
  if (event.object_type === "excerpt_card") {
    const annotationId = cardToAnnotation.get(event.object_id);
    return annotationId ? annotationObjectiveById.get(annotationId) ?? null : null;
  }
  if (event.object_type === "reading_path") {
    return typeof metadata.learning_objective_id === "string" ? metadata.learning_objective_id : null;
  }
  return null;
}

function parseEvent(
  event: EventLog,
  annotationObjectiveById: Map<string, string | null>,
  cardToAnnotation: Map<string, string>
): ParsedActivityEvent {
  const metadata = parseMetadata(event.metadata);
  return {
    id: event.id,
    event_type: event.event_type,
    label: EVENT_LABELS[event.event_type] ?? event.event_type.replace(/_/g, " "),
    agent_name: event.agent_name,
    object_type: event.object_type,
    object_id: event.object_id,
    latency_ms: event.latency_ms,
    status: event.status,
    created_at: event.created_at,
    metadata,
    learning_objective_id: resolveLearningObjectiveId(
      event,
      metadata,
      annotationObjectiveById,
      cardToAnnotation
    ),
  };
}

function buildSummary(events: ParsedActivityEvent[]) {
  const by_agent: Record<string, number> = {};
  const by_event_type: Record<string, number> = {};

  for (const event of events) {
    const agent = event.agent_name ?? "System";
    by_agent[agent] = (by_agent[agent] ?? 0) + 1;
    by_event_type[event.event_type] = (by_event_type[event.event_type] ?? 0) + 1;
  }

  return { total: events.length, by_agent, by_event_type };
}

export async function buildActivityTraceResponse(
  workspaceId: string,
  learningObjectiveId?: string | null
): Promise<ActivityTraceResponse | null> {
  const objective = getObjective(workspaceId);
  if (!objective) return null;

  const learning_objectives = listLearningObjectivesForWorkspace(workspaceId);
  const annotations = listAnnotationsForObjective(workspaceId);
  const annotationObjectiveById = new Map(
    annotations.map((a) => [a.id, a.learning_objective_id ?? null])
  );

  const cardToAnnotation = new Map<string, string>();
  for (const annotation of annotations) {
    const card = getExcerptCardByAnnotation(annotation.id);
    if (card) cardToAnnotation.set(card.id, annotation.id);
  }

  const clickhouse = await pingClickHouse();
  const chEvents = clickhouse ? await listReadingEvents(workspaceId) : [];
  const rawEvents = chEvents.length > 0 ? chEvents : listEventsForObjective(workspaceId);
  let events = rawEvents.map((event) =>
    parseEvent(event, annotationObjectiveById, cardToAnnotation)
  );

  if (learningObjectiveId) {
    events = events.filter(
      (event) =>
        event.learning_objective_id === learningObjectiveId ||
        event.learning_objective_id === null
    );
  }

  const analytics = await getEventAnalytics(workspaceId);

  return {
    trace_id: objective.trace_id,
    workspace_id: workspaceId,
    workspace_title: objective.title,
    learning_objectives,
    events,
    summary: buildSummary(events),
    clickhouse_analytics: analytics,
  };
}
