import { NextResponse } from "next/server";
import { getSemiontStatus } from "@/lib/semiont/status";

export async function GET() {
  const status = await getSemiontStatus();
  return NextResponse.json(status);
}
