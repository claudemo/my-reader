import Link from "next/link";
import { Nav } from "@/components/Nav";
import { HomeReadingsList } from "@/components/home/HomeReadingsList";
import { listObjectives, listSourcesForObjective } from "@/lib/repository";

export default function HomePage() {
  const readings = listObjectives().map((o) => {
    const source = listSourcesForObjective(o.id)[0] ?? null;
    return {
      id: o.id,
      title: o.title,
      description: o.description,
      output_intent: o.output_intent,
      book: source?.title ?? null,
      sourceType: source?.source_type ?? null,
      sourceUrl: source?.url.startsWith("upload://") ? null : source?.url ?? null,
      created_at: o.created_at,
    };
  });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="mb-10 rounded-2xl border border-stone-200 bg-gradient-to-br from-amber-50 to-stone-50 p-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-amber-800">
            MyReader
          </p>
          <h1 className="mb-3 max-w-2xl text-3xl font-semibold tracking-tight text-stone-900">
            Set your objective, get a map, then read.
          </h1>
          <p className="mb-6 max-w-2xl text-stone-600">
            Upload a PDF or pull from a website to start reading. Add objectives and generate a
            reading map in the sidebar when you are ready.
          </p>
          <Link
            href="/objectives/new"
            className="inline-flex rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
          >
            Upload a new file
          </Link>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-900">Your readings</h2>
          <HomeReadingsList readings={readings} />
        </section>
      </main>
    </>
  );
}
