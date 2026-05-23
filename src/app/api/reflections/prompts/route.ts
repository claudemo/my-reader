import { NextRequest, NextResponse } from "next/server";
import { getObjective } from "@/lib/repository";
import {
  generateReflectionPrompts,
} from "@/lib/agents/note-agent";
import { listNotesForObjective } from "@/lib/repository";
import { recordEvent, withTiming } from "@/lib/observability/events";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { objective_id } = body;
  const objective = getObjective(objective_id);
  if (!objective) {
    return NextResponse.json({ error: "objective not found" }, { status: 404 });
  }

  const notes = listNotesForObjective(objective_id);
  const { result: prompts, latency_ms } = await withTiming(() =>
    generateReflectionPrompts(objective, notes)
  );

  await recordEvent({
    trace_id: objective.trace_id,
    objective_id,
    event_type: "reflection_prompts_generated",
    object_type: "objective",
    object_id: objective_id,
    agent_name: "ReflectionAgent",
    latency_ms,
    status: "success",
    metadata: { prompt_count: prompts.length },
  });

  return NextResponse.json({ prompts, notes_count: notes.length });
}
