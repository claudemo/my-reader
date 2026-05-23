"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Nav } from "@/components/Nav";

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<{
    title: string;
    content: string;
    public_url: string;
  } | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function publish() {
    setLoading(true);
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: id }),
    });
    const data = await res.json();
    setPost(data.post ?? null);
    setProvider(data.provider ?? null);
    setLoading(false);
  }

  return (
    <>
      <Nav objectiveId={id} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-semibold text-stone-900">Publish cited learning post</h1>
        <p className="mb-6 text-stone-600">
          PublishAgent generates a grounded post with citations from your highlights and notes.
          Senso API is used when configured; otherwise posts save to{" "}
          <code className="text-xs">public/published/</code>.
        </p>

        {!post ? (
          <button
            type="button"
            onClick={publish}
            disabled={loading}
            className="rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Publishing…" : "Generate & publish"}
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-500">
              Published via {provider} ·{" "}
              <a href={post.public_url} className="text-amber-800 hover:underline" target="_blank" rel="noreferrer">
                View public artifact
              </a>
            </p>
            <article className="rounded-xl border border-stone-200 bg-white p-6 prose prose-stone max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{post.content}</pre>
            </article>
          </div>
        )}

        <Link
          href={`/objectives/${id}/trace`}
          className="mt-8 inline-block text-sm font-medium text-amber-800 hover:underline"
        >
          View full trace →
        </Link>
      </main>
    </>
  );
}
