import { NextResponse } from "next/server";
import { getClickHouseStatus } from "@/lib/clickhouse/client";

export async function GET() {
  const status = await getClickHouseStatus();
  return NextResponse.json(status);
}
