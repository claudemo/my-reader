"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadPanel({
  objectiveId,
  onUploaded,
  compact = false,
  redirectOnCreate = false,
}: {
  objectiveId?: string | null;
  onUploaded?: (result: { sourceId: string; objectiveId: string }) => void;
  compact?: boolean;
  redirectOnCreate?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    const form = new FormData();
    if (objectiveId) form.append("objective_id", objectiveId);
    form.append("file", file);

    try {
      const res = await fetch("/api/sources/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const result = {
        sourceId: data.id as string,
        objectiveId: (data.objective?.id ?? objectiveId) as string,
      };

      if (redirectOnCreate) {
        router.push(`/objectives/${result.objectiveId}`);
        return;
      }

      onUploaded?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div className={compact ? "space-y-3" : "mx-auto max-w-xl space-y-6"}>
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Upload your book</h2>
          <p className="mt-1 text-sm text-stone-600">
            Upload the PDF or text file for this reading session.
          </p>
        </div>
      )}

      {compact && (
        <p className="text-xs text-stone-600">PDF, .txt, or .md</p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed text-center transition-colors ${
          compact ? "p-5" : "p-10"
        } ${
          dragOver
            ? "border-amber-500 bg-amber-50"
            : "border-stone-300 bg-stone-50 hover:border-stone-400"
        }`}
      >
        <p className="text-sm font-medium text-stone-800">Drop file here</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Reading book…" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
