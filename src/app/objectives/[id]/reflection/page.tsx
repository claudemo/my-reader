"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

export default function ReflectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [prompts, setPrompts] = useState<string[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reflections/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: id }),
    })
      .then((r) => r.json())
      .then((data) => {
        setPrompts(data.prompts ?? []);
        setSelectedPrompt(data.prompts?.[0] ?? "");
      });
  }, [id]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective_id: id,
        prompt: selectedPrompt,
        user_response: form.get("user_response"),
      }),
    });
    setLoading(false);
    router.push(`/objectives/${id}/publish`);
  }

  return (
    <>
      <Nav objectiveId={id} />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-semibold text-stone-900">Reflection</h1>
        <p className="mb-6 text-stone-600">
          ReflectionAgent compares your notes against the learning objective.
        </p>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
          <label className="block text-sm font-medium text-stone-700">
            Prompt
            <select
              value={selectedPrompt}
              onChange={(e) => setSelectedPrompt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-sm"
            >
              {prompts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Your reflection
            <textarea
              name="user_response"
              required
              rows={5}
              placeholder="What changed in your understanding?"
              className="mt-1 w-full rounded-lg border border-stone-300 p-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save & continue to publish"}
          </button>
        </form>

        <Link href={`/objectives/${id}/notes`} className="mt-4 inline-block text-sm text-stone-500 hover:underline">
          ← Back to notes
        </Link>
      </main>
    </>
  );
}
