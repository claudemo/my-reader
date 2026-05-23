import { NextRequest, NextResponse } from "next/server";
import {
  createReflection,
  getObjective,
  listNotesForObjective,
} from "@/lib/repository";
import { synthesizeReflection } from "@/lib/agents/note-agent";
import { recordEvent, withTiming } from "@/lib/observability/events";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { objective_id, prompt, user_response } = body;

  const objective = getObjective(objective_id);
  if (!objective) {
    return NextResponse.json({ error: "objective not found" }, { status: 404 });
  }

  const notes = listNotesForObjective(objective_id);
  const { result: synthesis, latency_ms } = await withTiming(async () =>
    synthesizeReflection(objective, user_response ?? "", notes)
  );

  const reflection = createReflection({
    objective_id,
    prompt: prompt ?? "What changed in your understanding?",
    user_response: user_response ?? "",
    agent_synthesis: synthesis,
  });

  await recordEvent({
    trace_id: objective.trace_id,
    objective_id,
    event_type: "reflection_saved",
    object_type: "reflection",
    object_id: reflection.id,
    agent_name: "ReflectionAgent",
    latency_ms,
    status: "success",
  });

  return NextResponse.json(reflection, { status: 201 });
}
