import { NextResponse } from "next/server";
import { buildTraceResponse } from "@/lib/agents/trace-agent";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const trace = await buildTraceResponse(objectiveId);
  if (!trace) {
    return NextResponse.json({ error: "objective not found" }, { status: 404 });
  }
  return NextResponse.json(trace);
}
