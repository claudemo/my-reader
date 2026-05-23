import { NextRequest, NextResponse } from "next/server";
import {
  getLatestReadingPathForLearningObjective,
  getLearningObjective,
  getObjective,
  listSourcesForObjective,
  saveReadingPath,
  updateLearningObjective,
} from "@/lib/repository";
import { objectiveFromUserInput } from "@/lib/agents/objective-agent";
import { generateReadingMap } from "@/lib/agents/reading-map-agent";
import { traceAgent } from "@/lib/observability/lapdog";
import { recordEvent, withTiming } from "@/lib/observability/events";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ learningObjectiveId: string }> }
) {
  const { learningObjectiveId } = await params;
  const learningObjective = getLearningObjective(learningObjectiveId);
  if (!learningObjective) {
    return NextResponse.json({ error: "learning objective not found" }, { status: 404 });
  }

  const path = getLatestReadingPathForLearningObjective(learningObjectiveId);
  return NextResponse.json({ learning_objective: learningObjective, reading_map: path });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ learningObjectiveId: string }> }
) {
  const { learningObjectiveId } = await params;
  const learningObjective = getLearningObjective(learningObjectiveId);
  if (!learningObjective) {
    return NextResponse.json({ error: "learning objective not found" }, { status: 404 });
  }

  const workspace = getObjective(learningObjective.workspace_id);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const userObjective = body.user_objective?.toString().trim();
  if (!userObjective) {
    return NextResponse.json({ error: "user_objective required" }, { status: 400 });
  }

  const parsed = objectiveFromUserInput(userObjective);
  const updated = updateLearningObjective(learningObjectiveId, parsed);
  const workspaceSources = listSourcesForObjective(workspace.id);

  const { result, latency_ms } = await withTiming(() =>
    traceAgent(
      "ReadingMapAgent",
      workspace.trace_id,
      () =>
        generateReadingMap(updated, {
          workspaceSources,
          trace: { sessionId: workspace.trace_id },
        }),
      { learning_objective_id: learningObjectiveId }
    )
  );
  const path = saveReadingPath({
    workspace_id: learningObjective.workspace_id,
    learning_objective_id: learningObjectiveId,
    steps: result.steps,
    generator: result.generator,
    semiont_reranked: result.semiont_reranked,
    latency_ms,
  });

  await recordEvent({
    trace_id: workspace.trace_id,
    objective_id: workspace.id,
    event_type: "reading_map_generated",
    object_type: "reading_path",
    object_id: path.id,
    agent_name: "ReadingMapAgent",
    latency_ms,
    status: "success",
    metadata: {
      steps: result.steps.length,
      generator: result.generator,
      learning_objective_id: learningObjectiveId,
      source_count: workspaceSources.length,
      document_aware: workspaceSources.length > 0,
    },
  });

  return NextResponse.json({ learning_objective: updated, reading_map: path }, { status: 201 });
}
