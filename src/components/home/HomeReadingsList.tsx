"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface ReadingListItem {
  id: string;
  title: string;
  description: string;
  output_intent: string;
  book: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  created_at: string;
}

export function HomeReadingsList({ readings }: { readings: ReadingListItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(readings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function deleteReading(id: string) {
    const item = items.find((r) => r.id === id);
    const label = item?.book ?? item?.title ?? "this reading";
    if (!window.confirm(`Remove "${label}"? This cannot be undone.`)) return;

    setOpenMenuId(null);
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/objectives/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remove failed");
      setItems((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-stone-500">No readings yet. Start one to open the reader.</p>;
  }

  return (
    <>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <ul className="space-y-3">
        {items.map((o) => (
          <li
            key={o.id}
            className="group relative rounded-xl border border-stone-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-stone-900">
                    {o.book ?? (o.description ? o.title : "New reading")}
                  </p>
                  {o.sourceType && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-stone-500">
                      {o.sourceType === "web" ? "Web" : o.sourceType === "pdf" ? "PDF" : o.sourceType}
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-500">{o.description || "No objective yet"}</p>
                {o.sourceUrl && o.sourceType === "web" && (
                  <p className="mt-1 truncate text-xs text-stone-400">{o.sourceUrl}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/objectives/${o.id}`}
                  className="text-sm font-medium text-amber-800 hover:underline"
                >
                  Open reader →
                </Link>
                <Link
                  href={`/objectives/${o.id}/trace`}
                  className="text-sm text-stone-500 hover:text-stone-800"
                >
                  Trace
                </Link>
              </div>
            </div>

            <div
              ref={openMenuId === o.id ? menuRef : undefined}
              className="absolute right-3 top-3"
            >
              <button
                type="button"
                aria-label="Reading options"
                onClick={() => setOpenMenuId((id) => (id === o.id ? null : o.id))}
                className="rounded p-1 text-stone-300 opacity-0 transition-opacity hover:bg-stone-100 hover:text-stone-500 group-hover:opacity-100 data-[open=true]:opacity-100"
                data-open={openMenuId === o.id}
              >
                ···
              </button>
              {openMenuId === o.id && (
                <div className="absolute right-0 top-7 z-10 min-w-[8rem] rounded-lg border border-stone-200 bg-white py-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => deleteReading(o.id)}
                    disabled={deletingId === o.id}
                    className="block w-full px-3 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-700 disabled:opacity-50"
                  >
                    {deletingId === o.id ? "Removing…" : "Remove reading"}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
