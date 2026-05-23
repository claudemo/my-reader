import { NextResponse } from "next/server";
import { deleteLearningObjective, getLearningObjective } from "@/lib/repository";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getLearningObjective(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  deleteLearningObjective(id);
  return NextResponse.json({ ok: true });
}
