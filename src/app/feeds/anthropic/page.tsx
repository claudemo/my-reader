import { Nav } from "@/components/Nav";
import { AnthropicFeedPanel } from "@/components/feeds/AnthropicFeedPanel";
import { listAnthropicFeedLinks } from "@/lib/repository/anthropic-feed";

export const dynamic = "force-dynamic";

export default function AnthropicFeedPage() {
  const links = listAnthropicFeedLinks({ limit: 200 });
  const fetchedAt =
    links.length > 0
      ? links.reduce((latest, link) =>
          link.fetched_at > latest ? link.fetched_at : latest
        , links[0]!.fetched_at)
      : null;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-amber-800">
            Automatic agent
          </p>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-stone-900">
            Anthropic blog feed
          </h1>
          <p className="max-w-2xl text-stone-600">
            Links fetched automatically from Anthropic Research and Engineering. Use this page
            for hackathon demos or wire the JSON API into your own workflow.
          </p>
        </section>

        <AnthropicFeedPanel initialLinks={links} initialFetchedAt={fetchedAt} />
      </main>
    </>
  );
}
