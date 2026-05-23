import { NextRequest, NextResponse } from "next/server";
import { listAnthropicFeedLinks } from "@/lib/repository/anthropic-feed";
import type { AnthropicFeedSource } from "@/lib/types/anthropic-feed";

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 100, 500) : 100;

  const parsedSource =
    source === "research" || source === "engineering"
      ? (source as AnthropicFeedSource)
      : undefined;

  const links = listAnthropicFeedLinks({
    source: parsedSource,
    limit,
  });

  return NextResponse.json({
    links,
    count: links.length,
    agent: "AnthropicFeedAgent",
  });
}
