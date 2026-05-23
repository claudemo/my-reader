"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { HighlightReader } from "@/components/HighlightReader";

export default function ReaderPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const [source, setSource] = useState<{
    id: string;
    objective_id: string;
    title: string;
    sections: string[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/sources/${sourceId}`)
      .then((r) => r.json())
      .then(setSource);
  }, [sourceId]);

  if (!source) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-10">Loading reader…</main>
      </>
    );
  }

  return (
    <>
      <Nav objectiveId={source.objective_id} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <HighlightReader
          sourceId={source.id}
          objectiveId={source.objective_id}
          title={source.title}
          sections={source.sections}
        />
        <div className="mt-6 flex gap-4 text-sm">
          <Link
            href={`/objectives/${source.objective_id}/notes`}
            className="text-amber-800 hover:underline"
          >
            View generated notes →
          </Link>
        </div>
      </main>
    </>
  );
}
