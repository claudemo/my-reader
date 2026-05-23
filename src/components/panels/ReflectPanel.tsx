"use client";

import { FormEvent, useEffect, useState } from "react";

export function ReflectPanel({
  objectiveId,
  onDone,
}: {
  objectiveId: string;
  onDone: () => void;
}) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reflections/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: objectiveId }),
    })
      .then((r) => r.json())
      .then((d) => {
        setPrompts(d.prompts ?? []);
        setPrompt(d.prompts?.[0] ?? "");
      });
  }, [objectiveId]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective_id: objectiveId,
        prompt,
        user_response: form.get("user_response"),
      }),
    });
    setLoading(false);
    onDone();
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Reflection</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <select
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full rounded-lg border border-stone-300 p-2 text-sm"
        >
          {prompts.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <textarea
          name="user_response"
          required
          rows={5}
          placeholder="What changed in your understanding?"
          className="w-full rounded-lg border border-stone-300 p-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-stone-900 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save reflection"}
        </button>
      </form>
    </div>
  );
}
