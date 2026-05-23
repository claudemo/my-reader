import { NextRequest, NextResponse } from "next/server";
import { createObjective, listObjectives } from "@/lib/repository";
import { newTraceId } from "@/lib/utils/ids";
import { recordEvent } from "@/lib/observability/events";

export async function GET() {
  return NextResponse.json({ objectives: listObjectives() });
}

export async function POST(_req: NextRequest) {
  const trace_id = newTraceId();
  const objective = createObjective({
    title: "New reading",
    description: "",
    output_intent: "",
    trace_id,
  });

  await recordEvent({
    trace_id,
    objective_id: objective.id,
    event_type: "workspace_created",
    object_type: "objective",
    object_id: objective.id,
    status: "success",
  });

  return NextResponse.json(objective, { status: 201 });
}
