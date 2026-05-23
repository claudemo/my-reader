"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { ExportMarkdownButton } from "@/components/export/ExportMarkdownButton";

interface NoteRow {
  id: string;
  annotation_id: string;
  claim: string;
  explanation: string;
  analogy: string;
  application: string;
  open_question: string;
  concepts: string[];
}

interface CardRow {
  id: string;
  annotation_id: string;
  key_claim: string;
  evidence_role: string;
  concepts: string[];
}

export default function NotesPage() {
  const { id } = useParams<{ id: string }>();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);

  useEffect(() => {
    fetch(`/api/trace/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setNotes(data.notes ?? data.chain?.map((c: { note: NoteRow }) => c.note).filter(Boolean) ?? []);
        setCards(
          data.excerpt_cards ??
            data.chain?.map((c: { excerpt_card: CardRow }) => c.excerpt_card).filter(Boolean) ??
            []
        );
      });
  }, [id]);

  return (
    <>
      <Nav objectiveId={id} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-semibold text-stone-900">Excerpt cards & notes</h1>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-stone-600">
            Each highlight becomes a Semiont-style annotation, excerpt card, and atomic note.
          </p>
          <ExportMarkdownButton workspaceId={id} scope="notes" />
        </div>

        {notes.length === 0 ? (
          <p className="text-stone-500">
            No notes yet.{" "}
            <Link href={`/objectives/${id}/sources`} className="text-amber-800 hover:underline">
              Import a source and highlight text
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-6">
            {notes.map((note, i) => {
              const card = cards.find((c) => c.annotation_id === note.annotation_id);
              return (
                <article
                  key={note.id}
                  className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs uppercase text-stone-400">Atomic note {i + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold text-stone-900">{note.claim}</h2>
                  <p className="mt-2 text-stone-700">{note.explanation}</p>
                  <p className="mt-2 text-sm italic text-stone-600">{note.analogy}</p>
                  <p className="mt-2 text-sm text-stone-600">
                    <span className="font-medium">Apply:</span> {note.application}
                  </p>
                  <p className="mt-2 text-sm text-amber-900">
                    <span className="font-medium">Open question:</span> {note.open_question}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {note.concepts.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  {card && (
                    <p className="mt-2 text-xs text-stone-400">Evidence role: {card.evidence_role}</p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <Link
          href={`/objectives/${id}/reflection`}
          className="mt-8 inline-block text-sm font-medium text-amber-800 hover:underline"
        >
          Continue to reflection →
        </Link>
      </main>
    </>
  );
}
