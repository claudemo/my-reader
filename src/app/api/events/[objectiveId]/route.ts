import { NextResponse } from "next/server";
import { listEventsForObjective } from "@/lib/repository";
import { getEventAnalytics, listReadingEvents, pingClickHouse } from "@/lib/clickhouse/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params;
  const clickhouse = await pingClickHouse();
  const chEvents = clickhouse ? await listReadingEvents(objectiveId) : [];
  const events = chEvents.length > 0 ? chEvents : listEventsForObjective(objectiveId);
  const analytics = await getEventAnalytics(objectiveId);

  return NextResponse.json({
    events,
    clickhouse_connected: clickhouse,
    events_source: chEvents.length > 0 ? "clickhouse" : "sqlite",
    analytics,
  });
}
