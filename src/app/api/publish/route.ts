import { NextRequest, NextResponse } from "next/server";
import {
  createPublishedPost,
  getObjective,
  getReflectionForObjective,
  listAnnotationsForObjective,
  listNotesForObjective,
  listSourcesForObjective,
} from "@/lib/repository";
import { generatePublishedPost } from "@/lib/agents/note-agent";
import { publishToSenso } from "@/lib/agents/publish-agent";
import { recordEvent, withTiming } from "@/lib/observability/events";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { objective_id } = body;

  const objective = getObjective(objective_id);
  if (!objective) {
    return NextResponse.json({ error: "objective not found" }, { status: 404 });
  }

  const sources = listSourcesForObjective(objective_id);
  const annotations = listAnnotationsForObjective(objective_id);
  const notes = listNotesForObjective(objective_id);
  const reflection = getReflectionForObjective(objective_id);

  const { result: draft, latency_ms: draftLatency } = await withTiming(() =>
    generatePublishedPost(objective, sources, annotations, notes, reflection)
  );

  const { result: published, latency_ms: publishLatency } = await withTiming(() =>
    publishToSenso({
      objective,
      sources,
      annotations,
      notes,
      reflection,
      title: draft.title,
      content: draft.content,
    })
  );

  const post = createPublishedPost({
    objective_id,
    title: draft.title,
    content: draft.content,
    public_url: published.public_url,
    cited_sources: JSON.stringify(draft.cited_sources),
  });

  await recordEvent({
    trace_id: objective.trace_id,
    objective_id,
    event_type: "post_published",
    object_type: "published_post",
    object_id: post.id,
    agent_name: "PublishAgent",
    latency_ms: draftLatency + publishLatency,
    status: "success",
    metadata: { provider: published.provider },
  });

  return NextResponse.json({ post, provider: published.provider }, { status: 201 });
}
