import { NextResponse } from "next/server";
import {
  getLapdogAgentUrl,
  getLapdogDashboardUrl,
  getLapdogLocalId,
  isLapdogEnabled,
  pingLapdogAgent,
} from "@/lib/observability/lapdog";

export async function GET() {
  const enabled = isLapdogEnabled();
  const connected = enabled ? await pingLapdogAgent() : false;
  const local_id = getLapdogLocalId();

  return NextResponse.json({
    enabled,
    connected,
    local_id,
    agent_url: getLapdogAgentUrl(),
    dashboard_url: getLapdogDashboardUrl(),
  });
}
