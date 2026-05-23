# MyReader — Hackathon Submission

**Annotation-first reading workspace with document-aware agents, full audit trails, and exportable knowledge.**

---

## Inspiration

We built MyReader because reading alone is not the same as learning. Most tools treat a PDF or article as a static file — you scroll, maybe highlight, and hope something sticks. We wanted a workspace where **intent comes first**: you declare what you're trying to learn, an agent reads the document with you, and every highlight, note, and agent decision leaves a trace you can inspect and export.

The idea started from a simple frustration: AI can summarize anything, but summaries don't teach you to *read*. A reading map that points to specific pages and passages — grounded in the actual document — feels more like a tutor than a chatbot. MyReader is our answer: a goal-driven reading loop where agents assist without replacing the act of reading.

---

## What it does

MyReader is a full-stack reading workspace built around a clear loop:

**Workspace → Learning objective → Reading map → Read & highlight → Excerpt cards & notes → Export**

Here's what that looks like in practice:

- **Goal-driven workspaces** — Each reading session is an *objective* with a stable `trace_id`. You add *learning objectives* (what you want to understand and why), and the app generates a step-by-step **reading map** tied to your uploaded sources.

- **Multi-format import** — Upload PDFs, `.txt`/`.md` files, or paste a web URL. PDFs are extracted with `unpdf`; web articles go through Mozilla Readability with arXiv/PDF fallbacks. An **upload-first flow** creates the workspace immediately so you can drop a document before defining goals.

- **Document-aware reading maps** — The `ReadingMapAgent` doesn't hallucinate a generic study plan. It scores passages in your document against your objective keywords, surfaces page-level targets (`document_targets`), and optionally calls an LLM (OpenRouter/Gemini) to refine the path. Without API keys, deterministic templates still produce useful, document-grounded steps.

- **Highlight-driven notes** — Select text in the reader; each selection becomes an annotation, excerpt card, and atomic note in one action. Notes can be LLM-enriched on demand.

- **Full audit trail** — Every upload, map generation, highlight, and agent call is recorded as structured events. A **Trace** tab and dedicated trace page show the timeline; JSON logs go to stdout for debugging.

- **Markdown export** — One click assembles highlights, reading maps, notes, reflections, and published posts into workspace-scoped Markdown files.

- **Anthropic blog feed agent** — A cron-friendly automatic agent fetches the latest Research & Engineering post links from anthropic.com (RSS first, HTML fallback), dedupes by URL, and surfaces them at `/feeds/anthropic` — no API keys required.

- **Optional integrations** — Semiont (W3C Web Annotations), Nimble (web source discovery), and Senso (cited post publishing) when configured. The app works fully in local-only mode without them.

---

## How we built it

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.

**Agent layer** (`src/lib/agents/`) orchestrates the reading workflow:
- `ReadingMapAgent` — Parses learning objectives, calls `document-context` to score passages, generates structured map steps with page references
- `document-context` — Tokenizes objective text, scores paragraphs by keyword overlap and structural signals (headings, abstract, conclusion), returns ranked passages and outline sections
- `NoteAgent`, `SourceAgent`, `TraceAgent`, `PublishAgent` — Handle note enrichment, web search, activity summaries, and cited publishing
- `AnthropicFeedAgent` — Automatic RSS/HTML fetch for hackathon demo

**Document extraction:**
- PDFs: `unpdf` with custom **paragraph segmentation** — we reflow raw PDF line breaks into readable paragraphs using heuristics for sentence boundaries, headings, and column breaks, then split long blocks for display
- Web: `@mozilla/readability` + `linkedom` for article extraction; canonical URL normalization and content-hash caching
- Dual cache in SQLite `parsed_doc_cache` and ClickHouse `parsed_doc_cache` (ReplacingMergeTree) keyed by hash or URL

**Dual storage architecture:**
- **SQLite** (`better-sqlite3`) — Primary app state: objectives, sources, annotations, notes, reading paths, event logs
- **ClickHouse** (`@clickhouse/client`, Docker Compose) — Analytics on `reading_events` and cross-session parsed document cache. Events are dual-written via `recordEvent()`; the Trace UI prefers ClickHouse when connected

**LLM routing** (`src/lib/llm/client.ts`):
- Multi-provider support: OpenRouter (default, often routing to Gemini Flash), Google Gemini, OpenAI, NVIDIA NIM
- Graceful fallback to template-based output when no API keys are set — the demo works out of the box

**Observability:**
- `recordEvent()` writes to stdout, SQLite `event_logs`, and ClickHouse `reading_events`
- **Datadog Lapdog** + `dd-trace` LLM Observability wraps agent and LLM calls when `DD_LLMOBS_ENABLED=1`; sessions map to workspace `trace_id` for inspection at lapdog.datadoghq.com
- Dev orchestration scripts handle ClickHouse health checks, port management, and Lapdog-wrapped startup (`npm run dev:all:lapdog`)

**UI:** Workspace shell with sidebar panels (Map, Notes, Trace, Sources), `PdfReader` with paragraph-aware text rendering and highlight capture, export button in the header.

---

## Challenges we ran into

**PDF text is not paragraphs.** Raw PDF extraction gives you line-broken blobs, not readable prose. We iterated through several extraction versions (`EXTRACTION_VERSION = 4`) to build heuristics that detect when to merge lines vs. start a new paragraph — heading patterns, sentence endings, column reflow. Getting highlights to align with re-segmented text in `HighlightedPageText` required careful offset tracking.

**Reading maps that actually reference the document.** Early LLM-only map generation produced plausible but generic steps ("Read section 2", "Take notes"). The breakthrough was scoring real passages first with `document-context`, then feeding those targets into the map — so every step includes `document_targets` with page indices and excerpt hints.

**Dual storage without breaking local-only mode.** ClickHouse runs in Docker and may not be available. We designed `recordEvent()` to always succeed on SQLite and best-effort sync to ClickHouse, so the app never depends on analytics infrastructure to function.

**Dev environment port chaos.** Next.js on 3001, ClickHouse on 8123/9000, Lapdog on 8126 — and Semiont also wants 3001. We wrote port-check/clear scripts and a `dev:all` orchestrator with health waits so `npm run dev:all:lapdog` actually starts cleanly.

**Anthropic feed without an official API.** The blog has no documented RSS endpoint. Our agent tries multiple RSS URL candidates, falls back to HTML parsing of listing pages, dedupes by URL, and runs as a standalone CLI (`npm run fetch:anthropic`) suitable for cron.

**LLM observability in local dev.** Wiring `dd-trace` LLM Observability through Lapdog required careful session ID mapping from workspace `trace_id`, conditional bootstrap in `instrumentation.ts`, and making sure agent spans appear even when the LLM provider switches at runtime.

---

## Accomplishments that we're proud of

- **End-to-end agentic reading loop** — From upload to reading map to highlight to export, every step is agent-assisted and fully traced. Judges can follow the entire workflow in the Trace tab.

- **Document-grounded maps, not generic summaries** — Reading maps cite specific pages and passage previews from the user's actual document. The `document-context` scorer works without an LLM, so the core value proposition holds even in template mode.

- **Production-grade observability for a hackathon project** — Dual-written events to SQLite and ClickHouse, structured JSON logging, and Datadog Lapdog LLM traces keyed per workspace. We can answer "what did the agent do and why?" for every session.

- **Works without API keys** — Upload a PDF, set an objective, generate a map, highlight text, export Markdown. Template fallbacks mean the demo never depends on external LLM availability.

- **Automatic Anthropic feed agent** — A real cron-friendly agent that fetches ~35 blog links, dedupes, persists, and exposes a UI — built specifically for the hackathon "automatic agent" requirement.

- **Thoughtful PDF handling** — Custom paragraph segmentation, upload-first workspace creation, content-hash caching across sessions via ClickHouse, and paginated text rendering with highlight offset alignment.

- **Sponsor integration depth** — ClickHouse for analytics and doc cache, Datadog Lapdog for LLM observability, with hooks for Semiont, Nimble, and Senso when keys are present.

---

## What we learned

- **Ground agents in document structure, not just prompts.** Passage scoring and page-level targets made reading maps dramatically more useful than raw LLM output. The best agent UX often comes from retrieval + structure before generation.

- **Dual storage is worth the complexity.** SQLite keeps the app fast and simple; ClickHouse makes cross-session analytics and document cache queries trivial (`SELECT event_type, count() FROM reading_events GROUP BY event_type`). The dual-write pattern with graceful degradation was the right tradeoff.

- **Observability should be first-class, not an afterthought.** Mapping workspace `trace_id` to Lapdog sessions meant we could debug agent behavior during development and demo it live to judges. Structured events with agent names, latencies, and concepts made the Trace UI possible without custom logging infrastructure.

- **PDF extraction is an unsolved UX problem.** Line breaks, columns, and heading detection require domain-specific heuristics — no library gives you readable paragraphs out of the box. Versioning extraction (`EXTRACTION_VERSION`) let us invalidate stale caches when heuristics improve.

- **Template fallbacks enable better demos.** Building agents that work without API keys forced us to separate document scoring (deterministic) from LLM refinement (optional). The app is more resilient because of it.

- **Upload-first reduces friction.** Creating the workspace before asking for goals lets users start with the document they already have, then articulate intent — matching how people actually read.

---

## What's next for MyReader

- **Semantic search across highlights and notes** — Query your reading history by concept, not just keyword; leverage ClickHouse full-text and vector capabilities for cross-workspace recall.

- **Collaborative reading workspaces** — Shared objectives where multiple readers contribute highlights and agents merge perspectives into a collective reading map.

- **Smarter map adaptation** — Regenerate map steps as you highlight and take notes, so the path evolves based on what you've actually engaged with.

- **Deeper Semiont integration** — Bidirectional W3C annotation sync, knowledge-graph context for note generation, and AI-suggested highlights via SSE streams.

- **Production deployment** — Vercel for the Next.js app, ClickHouse Cloud for analytics, scheduled Anthropic feed agent, and forwarded Lapdog traces to Datadog LLM Observability in production.

- **Mobile-friendly reading** — Responsive reader with touch highlight capture for reading on the go.

- **More automatic agents** — arXiv feed monitoring, citation graph expansion, and scheduled re-import of updated sources.

---

*Built with Next.js 16, React 19, SQLite, ClickHouse, OpenRouter/Gemini, and Datadog Lapdog.*
