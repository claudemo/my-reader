import Link from "next/link";

export function Nav({ objectiveId }: { objectiveId?: string }) {
  const steps = objectiveId
    ? [
        { href: `/objectives/${objectiveId}/sources`, label: "Sources" },
        { href: `/objectives/${objectiveId}/notes`, label: "Notes" },
        { href: `/objectives/${objectiveId}/reflection`, label: "Reflect" },
        { href: `/objectives/${objectiveId}/publish`, label: "Publish" },
        { href: `/objectives/${objectiveId}/trace`, label: "Trace" },
      ]
    : [];

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-stone-900">
          MyReader
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/feeds/anthropic" className="text-stone-600 hover:text-stone-900">
            Anthropic feed
          </Link>
          <Link href="/objectives/new" className="text-stone-600 hover:text-stone-900">
            New reading
          </Link>
          {steps.map((s) => (
            <Link key={s.href} href={s.href} className="text-stone-600 hover:text-stone-900">
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
