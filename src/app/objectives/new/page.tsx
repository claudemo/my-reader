"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UploadPanel } from "@/components/panels/UploadPanel";
import { WebImportPanel } from "@/components/panels/WebImportPanel";

export default function NewObjectivePage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start reading workspace");
        setWorkspaceId(data.id);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to start");
      });
  }, []);

  function onSourceAdded({ objectiveId }: { sourceId: string; objectiveId: string }) {
    router.replace(`/objectives/${objectiveId}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <Link href="/" className="font-semibold text-stone-900">
          MyReader
        </Link>
        <p className="text-sm text-stone-500">New reading</p>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        {error ? (
          <p className="text-center text-sm text-red-600">{error}</p>
        ) : !workspaceId ? (
          <p className="text-center text-sm text-stone-500">Preparing workspace…</p>
        ) : (
          <div className="space-y-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Step 1
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-stone-900">Upload your book</h1>
              <p className="mt-2 text-sm text-stone-600">
                Drop a PDF or text file to open the reader. Add objectives and a reading map
                afterward in the sidebar.
              </p>
            </div>

            <UploadPanel
              objectiveId={workspaceId}
              onUploaded={onSourceAdded}
            />
            <WebImportPanel objectiveId={workspaceId} onImported={onSourceAdded} />
          </div>
        )}
      </main>
    </div>
  );
}
