"use client";

import { useState } from "react";

export function PublishPanel({ objectiveId }: { objectiveId: string }) {
  const [post, setPost] = useState<{ public_url: string; title: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function publish() {
    setLoading(true);
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: objectiveId }),
    });
    const data = await res.json();
    setPost(data.post ?? null);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Publish cited post</h2>
      {!post ? (
        <button
          type="button"
          onClick={publish}
          disabled={loading}
          className="rounded-lg bg-stone-900 px-6 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Publishing…" : "Generate & publish"}
        </button>
      ) : (
        <p className="text-sm">
          Published:{" "}
          <a href={post.public_url} className="text-amber-800 hover:underline" target="_blank" rel="noreferrer">
            {post.title}
          </a>
        </p>
      )}
    </div>
  );
}
