import { NextResponse } from "next/server";
import { runAnthropicFeedAgent } from "@/lib/agents/anthropic-feed-agent";
import { withTiming } from "@/lib/observability/events";

export async function POST() {
  try {
    const { result, latency_ms } = await withTiming(() => runAnthropicFeedAgent());

    return NextResponse.json({
      ...result,
      agent: "AnthropicFeedAgent",
      latency_ms,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anthropic feed fetch failed";
    return NextResponse.json({ error: message, agent: "AnthropicFeedAgent" }, { status: 502 });
  }
}
