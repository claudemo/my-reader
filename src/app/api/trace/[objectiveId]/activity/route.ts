import { NextRequest, NextResponse } from "next/server";
import { buildActivityTraceResponse } from "@/lib/trace/activity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const learningObjectiveId = req.nextUrl.searchParams.get("learning_objective_id");

  const trace = await buildActivityTraceResponse(
    objectiveId,
    learningObjectiveId || null
  );

  if (!trace) {
    return NextResponse.json({ error: "reading not found" }, { status: 404 });
  }

  return NextResponse.json(trace);
}
