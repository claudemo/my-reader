"use client";

import { UploadPanel } from "@/components/panels/UploadPanel";
import { WebImportPanel } from "@/components/panels/WebImportPanel";

export function ReaderUploadState({
  workspaceId,
  onUploaded,
}: {
  workspaceId: string;
  onUploaded: (result: { sourceId: string; objectiveId: string }) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-stone-100 px-6 py-10">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reader</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">Upload your book</h1>
          <p className="mt-2 text-sm text-stone-600">
            Add a PDF or pull from a website to start reading. You can set objectives and generate
            a map in the sidebar anytime.
          </p>
        </div>

        <UploadPanel objectiveId={workspaceId} onUploaded={onUploaded} />
        <WebImportPanel objectiveId={workspaceId} onImported={onUploaded} />
      </div>
    </div>
  );
}
