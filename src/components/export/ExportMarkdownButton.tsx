"use client";

import { useState } from "react";

export function ExportMarkdownButton({
  workspaceId,
  learningObjectiveId,
  scope = "notes",
  compact = false,
}: {
  workspaceId: string;
  learningObjectiveId?: string | null;
  scope?: "notes" | "full";
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportMarkdown() {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ scope });
      if (learningObjectiveId) {
        params.set("learning_objective_id", learningObjectiveId);
      }

      const res = await fetch(`/api/objectives/${workspaceId}/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="([^"]+)"/)?.[1] ??
        (scope === "full" ? "myreader-full.md" : "myreader-notes.md");

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      const savedPath = res.headers.get("X-Export-Saved-Path");
      setMessage(savedPath ? "Downloaded and saved to data/exports." : "Downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        onClick={exportMarkdown}
        disabled={loading}
        className={
          compact
            ? "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
            : "rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
        }
      >
        {loading ? "Exporting…" : scope === "full" ? "Export full MD" : "Export notes MD"}
      </button>
      {message && (
        <p className={`text-[11px] ${message.includes("failed") ? "text-red-600" : "text-emerald-700"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
