# MyReader — Start, Test, and Semiont Explained

This doc is the fastest path from zero to a working demo, with Semiont explained in plain English.

---

## What MyReader does (30 seconds)

MyReader is a **reading companion**:

```
Your objective → Reading map (agent) → Upload book → Read → Highlight → Notes
```

You enter what you want to learn in **Map**. The agent builds a path, then you upload the book to read in the main panel.

---

## What Semiont is (and what it is NOT)

**Semiont** is a separate open-source knowledge platform. Think of it as:

- A **wiki + annotator** for documents
- Built on **W3C Web Annotations** (standard way to mark “this text span means X”)
- A **knowledge graph** that grows as you highlight and tag

**MyReader uses Semiont as the annotation/knowledge layer** — not as the whole app.

### Simple mental model

| In MyReader | In Semiont terms |
|--------------|------------------|
| Imported article/PDF text | **Resource** (a document) |
| Your text selection | **Highlight** (text span) |
| Structured metadata on that span | **Annotation** (W3C format) |
| AI-suggested passages | **MARK flow** (Semiont AI detection) |
| Related concepts from the graph | **Context** (graph lookup) |

### Two modes

| Mode | What happens |
|------|----------------|
| **Local mode** (default) | No Semiont server needed. Highlights save to SQLite as annotations + notes. Demo works fully. |
| **Live Semiont** | Same highlights **also sync** to a running Semiont server. You get a real knowledge graph + AI marking. |

**You do not need Semiont running for the hackathon demo.** Local mode is intentional.

---

## When MyReader talks to Semiont

Only if `SEMIONT_BASE_URL` is set **and** the server responds:

1. **Import source** → `POST /api/resources` (register document in Semiont)
2. **Save highlight** → `POST /api/resources/:id/annotations` (W3C annotation)
3. **Generate note** → optional `discover-context` (pull graph context into excerpt card)
4. **Suggest highlights** → `detect-annotations-stream` (AI MARK flow)

Code lives in `src/lib/semiont/client.ts`.

If Semiont is offline, MyReader silently continues in local mode.

---

## Quick start (5 minutes)

### 1. Install and run

```bash
cd my-reader
npm install
cp .env.example .env.local   # optional keys
npm run dev
```

Open **http://localhost:3001**

> MyReader uses port **3001**. Semiont’s default API is also 3001 — don’t run both on the same port. See “Connect Semiont” below.

### 2. Optional: ClickHouse analytics

```bash
npm run clickhouse:up
```

Events dual-write to SQLite (always) and ClickHouse (when Docker is up).

### 3. Demo flow (no API keys required)

1. **Home** → **Start reading**
2. **Map** tab (sidebar): enter your learning objective → **Generate map**
3. Upload your book in the Map tab (required after the map is generated)
4. The **PDF opens in the main reader**
5. Sidebar **Objective** shows your goal; **Notes** collects highlights
6. Select text in the page excerpt bar → **Save highlight**

### 4. Check Semiont status

```bash
curl http://localhost:3001/api/semiont/status
```

Or open workspace → **Annotations** side tab (shows Live sync vs Local mode).

---

## Connect Semiont (optional, for sponsor track)

### Step 1: Run Semiont separately

Follow [Semiont local dev docs](https://github.com/The-AI-Alliance/semiont):

```bash
# In a separate folder — not inside my-reader
git clone https://github.com/The-AI-Alliance/semiont.git
cd semiont
# follow their README to start backend (default API ~ port 3001)
```

### Step 2: Avoid port conflict

| App | Suggested port |
|-----|----------------|
| MyReader | 3001 (`npm run dev`) |
| Semiont API | 3000 or 3002 |

### Step 3: Configure MyReader

In `.env.local`:

```bash
SEMIONT_BASE_URL=http://localhost:3002
SEMIONT_TOKEN=          # if your Semiont instance requires auth
```

Restart `npm run dev`. The Annotations panel should show **Live sync**.

### Step 4: Verify sync

1. Import a source
2. Save a highlight
3. Check annotation list for `semiont:...` id
4. Confirm resource exists in Semiont UI/API

---

## LLM keys (optional, for better notes)

Set **one** provider in `.env.local`:

```bash
OPENAI_API_KEY=sk-...
# or OPENROUTER_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY
```

Without keys, agents use templates. Header shows `LLM: template`.

---

## Workspace UI map

```
┌─────────────┬──────────────────────────┬─────────────────────┐
│ Workflow    │ Main                     │ Side tabs           │
│ sidebar     │                          │                     │
│             │                          │ Objective           │
│ Objective   │ Document / panels        │ Excerpts            │
│ Source      │                          │ Annotations         │
│ Read        │                          │ (Semiont tools)     │
│ Reflect     │                          │                     │
│ Publish     │                          │                     │
│ Trace       │                          │                     │
└─────────────┴──────────────────────────┴─────────────────────┘
        ↑ Header dropdown jumps to any section
```

---

## API smoke test

```bash
BASE=http://localhost:3001

# Create objective
curl -s -X POST "$BASE/api/objectives" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"demo","output_intent":"learn"}'

# Semiont status
curl -s "$BASE/api/semiont/status"
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 3001 in use | `npm run ports:clear` then `npm run dev:all`, or `npm run ports:check` |
| ClickHouse ECONNREFUSED | `npm run clickhouse:up` or use `npm run dev:all` |
| Semiont shows Local mode but URL is set | Semiont server not running or wrong port |
| Highlight save fails | Select text in **Read** view first |
| ClickHouse errors in logs | Safe to ignore if Docker not running; SQLite still works |
| Notes feel generic | Add an LLM API key |

---

## File map (where to look)

| What | Where |
|------|--------|
| Semiont HTTP client | `src/lib/semiont/client.ts` |
| W3C annotation shape | `src/lib/semiont/annotations.ts` |
| Semiont status | `src/lib/semiont/status.ts` |
| Annotation save flow | `src/app/api/annotations/route.ts` |
| Workspace UI | `src/app/objectives/[id]/page.tsx` |
| Agents | `src/lib/agents/` |
| SQLite schema | `src/lib/db/index.ts` |

---

## One-line pitch

**MyReader** is the reading workflow; **Semiont** is the optional semantic annotation layer underneath. Run MyReader alone for the demo; plug in Semiont when you want a real knowledge graph.
