import { NextRequest, NextResponse } from "next/server";
import { getObjective, getSource } from "@/lib/repository";
import { detectAnnotationsWithSemiont } from "@/lib/semiont/client";
import { recordEvent, withTiming } from "@/lib/observability/events";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { source_id, instructions } = body;

  const source = getSource(source_id);
  if (!source) {
    return NextResponse.json({ error: "source not found" }, { status: 404 });
  }

  const objective = getObjective(source.objective_id);
  if (!objective) {
    return NextResponse.json({ error: "objective not found" }, { status: 404 });
  }

  const resourceId = source.semiont_resource_id ?? source.id;
  const prompt =
    instructions ??
    `Suggest highlights relevant to: ${objective.title}. ${objective.description}`;

  const { result: suggestions, latency_ms } = await withTiming(() =>
    detectAnnotationsWithSemiont(resourceId, prompt)
  );

  await recordEvent({
    trace_id: objective.trace_id,
    objective_id: objective.id,
    event_type: "semiont_suggestions",
    object_type: "source",
    object_id: source.id,
    agent_name: "SemiontMarkAgent",
    latency_ms,
    status: "success",
    metadata: { count: suggestions.length, semiont_configured: Boolean(process.env.SEMIONT_BASE_URL) },
  });

  if (suggestions.length === 0 && !process.env.SEMIONT_BASE_URL) {
    const isAttention =
      source.title.toLowerCase().includes("attention") ||
      source.url.includes("1706.03762");
    return NextResponse.json({
      suggestions: isAttention
        ? [
            {
              text: "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.",
              motivation: "highlighting",
            },
            {
              text: "Self-attention has been used successfully in a variety of tasks including reading comprehension.",
              motivation: "assessment",
            },
          ]
        : [
            {
              text: "Durable execution records workflow progress so it can resume after failure.",
              motivation: "highlighting",
            },
          ],
      mode: "demo",
      hint: "Set SEMIONT_BASE_URL to connect a Semiont server for live AI-assisted marking.",
    });
  }

  return NextResponse.json({ suggestions, mode: "semiont" });
}
