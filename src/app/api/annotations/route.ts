import { NextRequest, NextResponse } from "next/server";
import {
  createAnnotation,
  createExcerptCard,
  createNote,
  getLearningObjective,
  getObjective,
  getSource,
  updateAnnotationSemiontId,
} from "@/lib/repository";
import { syncAnnotationToSemiont } from "@/lib/semiont/client";
import { recordEvent } from "@/lib/observability/events";

function excerptFromHighlight(
  annotation: { selected_text: string; user_comment: string | null; surrounding_context: string },
  objectiveTitle: string
) {
  return {
    relevance_to_objective:
      annotation.user_comment?.trim() ||
      `Saved while reading for "${objectiveTitle}".`,
    key_claim: annotation.selected_text.trim().slice(0, 300),
    evidence_role: "definition" as const,
    confidence: 1,
    concepts: [] as string[],
    application: "",
    open_question: "",
  };
}

function noteFromHighlight(
  annotation: { selected_text: string; user_comment: string | null; surrounding_context: string }
) {
  return {
    claim: annotation.selected_text.trim().slice(0, 300),
    explanation:
      annotation.user_comment?.trim() ||
      annotation.surrounding_context.trim().slice(0, 500),
    analogy: "",
    application: "",
    open_question: "",
    concepts: [] as string[],
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    objective_id,
    learning_objective_id,
    source_id,
    selected_text,
    surrounding_context,
    start_offset,
    end_offset,
    user_comment,
    page_index,
  } = body;

  if (!selected_text?.trim()) {
    return NextResponse.json({ error: "selected_text required" }, { status: 400 });
  }

  const objective = getObjective(objective_id);
  const source = getSource(source_id);
  if (!objective || !source) {
    return NextResponse.json({ error: "objective or source not found" }, { status: 404 });
  }

  if (learning_objective_id) {
    const lo = getLearningObjective(learning_objective_id);
    if (!lo || lo.workspace_id !== objective_id) {
      return NextResponse.json({ error: "learning objective not found" }, { status: 404 });
    }
  }

  const annotation = createAnnotation({
    objective_id,
    learning_objective_id: learning_objective_id ?? null,
    source_id,
    selected_text: selected_text.trim(),
    surrounding_context: surrounding_context ?? selected_text,
    start_offset: start_offset ?? 0,
    end_offset: end_offset ?? selected_text.length,
    annotation_type: "highlight",
    user_comment: user_comment ?? null,
    page_index: typeof page_index === "number" ? page_index : null,
  });

  const semiontAnnId = await syncAnnotationToSemiont(annotation, source);
  if (semiontAnnId) {
    updateAnnotationSemiontId(annotation.id, semiontAnnId);
    annotation.semiont_annotation_id = semiontAnnId;
  }

  const card = createExcerptCard(
    annotation.id,
    excerptFromHighlight(annotation, objective.title)
  );
  const note = createNote(annotation.id, noteFromHighlight(annotation));

  await recordEvent({
    trace_id: objective.trace_id,
    objective_id,
    event_type: "highlight_saved",
    object_type: "annotation",
    object_id: annotation.id,
    agent_name: "AnnotationAgent",
    source_url: source.url,
    status: "success",
    metadata: learning_objective_id ? { learning_objective_id } : undefined,
  });

  return NextResponse.json(
    { annotation, excerpt_card: card, note },
    { status: 201 }
  );
}
