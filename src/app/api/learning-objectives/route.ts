import { NextRequest, NextResponse } from "next/server";
import {
  createLearningObjective,
  getObjective,
  listLearningObjectivesForWorkspace,
} from "@/lib/repository";
import { objectiveFromUserInput } from "@/lib/agents/objective-agent";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspace_id");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }
  if (!getObjective(workspaceId)) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }
  return NextResponse.json({ learning_objectives: listLearningObjectivesForWorkspace(workspaceId) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const workspace_id = body.workspace_id?.toString();
  const user_objective = body.user_objective?.toString().trim();

  if (!workspace_id) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }
  if (!getObjective(workspace_id)) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  const parsed = user_objective
    ? objectiveFromUserInput(user_objective)
    : {
        title: "New objective",
        description: "",
        output_intent: "",
      };

  const lo = createLearningObjective({
    workspace_id,
    title: parsed.title,
    description: parsed.description,
    output_intent: parsed.output_intent,
  });

  return NextResponse.json({ learning_objective: lo }, { status: 201 });
}
