import { NextResponse } from "next/server";
import {
  getAnnotation,
  getExcerptCardByAnnotation,
  getObjective,
  getSource,
  createExcerptCard,
} from "@/lib/repository";
import { generateExcerptCard } from "@/lib/agents/note-agent";
import { recordEvent, withTiming } from "@/lib/observability/events";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const annotation = getAnnotation(id);
  if (!annotation) {
    return NextResponse.json({ error: "annotation not found" }, { status: 404 });
  }

  const existing = getExcerptCardByAnnotation(id);
  if (existing) {
    return NextResponse.json({ excerpt_card: existing });
  }

  const objective = getObjective(annotation.objective_id)!;
  const source = getSource(annotation.source_id)!;

  const { result: cardData, latency_ms } = await withTiming(() =>
    generateExcerptCard(annotation, source, objective)
  );
  const card = createExcerptCard(id, cardData);

  await recordEvent({
    trace_id: objective.trace_id,
    objective_id: objective.id,
    event_type: "excerpt_card_generated",
    object_type: "excerpt_card",
    object_id: card.id,
    agent_name: "AnnotationAgent",
    concepts: card.concepts,
    latency_ms,
    status: "success",
  });

  return NextResponse.json({ excerpt_card: card });
}
