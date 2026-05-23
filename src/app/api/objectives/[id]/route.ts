import { NextResponse } from "next/server";
import {
  deleteObjective,
  getObjective,
  listAnnotationsForObjective,
  listExcerptCardsForObjective,
  listLearningObjectivesForWorkspace,
  listNotesForObjective,
  listSourcesForObjective,
} from "@/lib/repository";
import { getProviderLabel } from "@/lib/llm/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const objective = getObjective(id);
  if (!objective) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    objective,
    learning_objectives: listLearningObjectivesForWorkspace(id),
    sources: listSourcesForObjective(id).map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      semiont_resource_id: s.semiont_resource_id,
    })),
    annotations: listAnnotationsForObjective(id),
    excerpt_cards: listExcerptCardsForObjective(id),
    notes: listNotesForObjective(id),
    llm_provider: getProviderLabel(),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteObjective(id);
  if (!deleted) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
