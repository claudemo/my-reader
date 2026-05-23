"use client";

import { useEffect, useState } from "react";

export function TracePanel({ objectiveId }: { objectiveId: string }) {
  const [trace, setTrace] = useState<{
    trace_id: string;
    chain: unknown[];
    events: unknown[];
    published_post: { public_url: string; title: string } | null;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/trace/${objectiveId}`)
      .then((r) => r.json())
      .then(setTrace);
  }, [objectiveId]);

  if (!trace) return <p className="text-stone-500">Loading trace…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="font-mono text-xs text-stone-500">trace_id: {trace.trace_id}</p>
      <p className="text-sm text-stone-600">
        Chain steps: {trace.chain.length} · Events: {trace.events.length}
      </p>
      {trace.published_post && (
        <a href={trace.published_post.public_url} className="text-sm text-amber-800 hover:underline">
          {trace.published_post.title}
        </a>
      )}
    </div>
  );
}
