import { NextRequest, NextResponse } from "next/server";
import { getObjective } from "@/lib/repository";
import { searchSources } from "@/lib/agents/source-agent";
import { recordEvent, withTiming } from "@/lib/observability/events";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { objective_id } = body;

  const objective = getObjective(objective_id);
  if (!objective) {
    return NextResponse.json({ error: "objective not found" }, { status: 404 });
  }

  const { result: sources, latency_ms } = await withTiming(() =>
    searchSources(objective.title, objective.description)
  );

  await recordEvent({
    trace_id: objective.trace_id,
    objective_id: objective.id,
    event_type: "sources_searched",
    object_type: "objective",
    object_id: objective.id,
    agent_name: "SourceAgent",
    latency_ms,
    status: "success",
    metadata: { count: sources.length },
  });

  return NextResponse.json({ sources, agent: "SourceAgent" });
}
