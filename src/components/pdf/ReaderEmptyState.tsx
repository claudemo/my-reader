"use client";

export function ReaderEmptyState({ onOpenMap }: { onOpenMap?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-stone-100 px-6">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reader</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">Your book opens here</h1>
        <p className="mt-2 text-sm text-stone-600">
          Go to the <strong>Map</strong> tab: enter your learning objective, generate a reading
          map, then upload a PDF or pull from a website.
        </p>
        {onOpenMap && (
          <button
            type="button"
            onClick={onOpenMap}
            className="mt-6 rounded-lg bg-violet-800 px-5 py-2.5 text-sm font-medium text-white"
          >
            Open Map
          </button>
        )}
      </div>
    </div>
  );
}
