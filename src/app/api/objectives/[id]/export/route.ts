import { NextRequest, NextResponse } from "next/server";
import {
  buildMarkdownExport,
  saveMarkdownExport,
  type ExportScope,
} from "@/lib/export/markdown";
import {
  getLatestReadingPathForLearningObjective,
  getObjective,
  getPublishedPostForObjective,
  getReflectionForObjective,
  listAnnotationsForObjective,
  listExcerptCardsForObjective,
  listLearningObjectivesForWorkspace,
  listNotesForObjective,
  listSourcesForObjective,
} from "@/lib/repository";
import { recordEvent } from "@/lib/observability/events";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;
  const workspace = getObjective(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  const scopeParam = req.nextUrl.searchParams.get("scope") ?? "notes";
  const scope: ExportScope = scopeParam === "full" ? "full" : "notes";
  const learningObjectiveId = req.nextUrl.searchParams.get("learning_objective_id");
  const save = req.nextUrl.searchParams.get("save") !== "0";

  const learningObjectives = listLearningObjectivesForWorkspace(workspaceId);
  const readingPaths = learningObjectives.map((learningObjective) => ({
    learningObjective,
    path: getLatestReadingPathForLearningObjective(learningObjective.id),
  }));

  const { filename, content } = buildMarkdownExport({
    workspace,
    sources: listSourcesForObjective(workspaceId),
    learningObjectives,
    annotations: listAnnotationsForObjective(workspaceId),
    excerptCards: listExcerptCardsForObjective(workspaceId),
    notes: listNotesForObjective(workspaceId),
    readingPaths,
    reflection: getReflectionForObjective(workspaceId),
    publishedPost: getPublishedPostForObjective(workspaceId),
    scope,
    activeLearningObjectiveId: learningObjectiveId,
  });

  let savedPath: string | null = null;
  if (save) {
    savedPath = saveMarkdownExport(workspaceId, filename, content);
  }

  await recordEvent({
    trace_id: workspace.trace_id,
    objective_id: workspaceId,
    event_type: "notes_exported",
    object_type: "export",
    object_id: workspaceId,
    status: "success",
    metadata: {
      scope,
      learning_objective_id: learningObjectiveId,
      filename,
      saved_path: savedPath,
    },
  });

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-Saved-Path": savedPath ?? "",
    },
  });
}
