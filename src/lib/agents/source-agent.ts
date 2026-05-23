import type { SourceSearchResult } from "@/lib/types";

const DEMO_SOURCES: SourceSearchResult[] = [
  {
    title: "Attention Is All You Need",
    url: "https://arxiv.org/abs/1706.03762",
    snippet:
      "The Transformer architecture relies entirely on self-attention, dispensing with recurrence and convolutions.",
    source_type: "paper",
    relevance_reason: "Foundational paper for modern LLMs — ideal hackathon demo source.",
  },
  {
    title: "Durable Execution for AI Agents",
    url: "https://temporal.io/blog/durable-execution",
    snippet:
      "Durable execution records workflow progress so it can resume after failure — critical for long-running agent tasks.",
    source_type: "article",
    relevance_reason: "Directly addresses agent runtime reliability and checkpointing.",
  },
  {
    title: "Building Effective Agents (Anthropic)",
    url: "https://www.anthropic.com/research/building-effective-agents",
    snippet:
      "Agents work best when workflows are decomposed into discrete steps with clear state transitions.",
    source_type: "article",
    relevance_reason: "Framework for structuring agent loops and tool use.",
  },
];

export async function searchSources(
  objectiveTitle: string,
  description: string
): Promise<SourceSearchResult[]> {
  const apiKey = process.env.NIMBLE_API_KEY;
  const query = `${objectiveTitle} ${description}`.trim();

  if (!apiKey) {
    return DEMO_SOURCES.map((s) => ({
      ...s,
      relevance_reason: `[demo] ${s.relevance_reason} (matches: "${objectiveTitle}")`,
    }));
  }

  try {
    const res = await fetch("https://api.nimbleway.com/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, limit: 8 }),
    });
    if (!res.ok) return DEMO_SOURCES;
    const data = (await res.json()) as {
      results?: Array<{ title: string; url: string; snippet: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source_type: "web",
      relevance_reason: "Ranked by Nimble for your learning objective.",
    }));
  } catch {
    return DEMO_SOURCES;
  }
}

export async function fetchSourceContent(
  url: string,
  title: string
): Promise<{ text: string; author: string; title: string }> {
  if (
    url.includes("arxiv.org/abs/1706.03762") ||
    url.includes("1706.03762") ||
    title.toLowerCase().includes("attention is all you need")
  ) {
    return { author: "Vaswani et al.", text: ATTENTION_PAPER_EXCERPT, title: "Attention Is All You Need" };
  }

  if (url.includes("temporal.io") || title.toLowerCase().includes("durable")) {
    return {
      author: "Temporal Team",
      text: SAMPLE_DURABLE_EXECUTION_ARTICLE,
      title: "Durable Execution for AI Agents",
    };
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MyReader-Agent/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error("fetch failed");
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle =
      titleMatch?.[1]?.replace(/\s+/g, " ").trim() ||
      title.trim() ||
      new URL(url).hostname;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, 50000);
    if (text.length < 200) throw new Error("too little text extracted");
    return { text, author: new URL(url).hostname, title: pageTitle };
  } catch {
    return {
      author: "MyReader Demo",
      text: SAMPLE_DURABLE_EXECUTION_ARTICLE,
      title: title.trim() || "Web article",
    };
  }
}

const SAMPLE_DURABLE_EXECUTION_ARTICLE = `# Durable Execution for AI Agents

## Why agents need durability

Modern AI agents run multi-step workflows: planning, tool calls, retrieval, and synthesis. A single network blip or model timeout should not force the entire run to restart from scratch.

Durable execution records workflow progress so it can resume after failure. Each completed step is checkpointed. When the process crashes, the orchestrator replays only from the last incomplete step.

## Core concepts

**Workflow state** persists outside the agent process. The runtime stores inputs, outputs, and metadata for every step.

**Deterministic replay** lets the system reconstruct context without re-invoking expensive LLM calls for steps that already succeeded.

**Idempotent tools** ensure that retried steps do not duplicate side effects — essential when agents write to databases or send messages.

## Agent runtime reliability

For agent frameworks, durability means:
- Tool results are cached per step ID
- Human-in-the-loop approvals can pause and resume days later
- Long-running research agents survive deploys and restarts

Without durable execution, agents are fragile loops. With it, they become reliable workers that accumulate evidence over time.

## Implementation patterns

1. **Event sourcing** — append step events to a log; rebuild state from events.
2. **Task queues** — each step is a job with retry policy and dead-letter handling.
3. **Workflow engines** — Temporal, Inngest, or custom orchestrators manage state machines.

## Open questions

How much non-determinism from LLMs can replay tolerate? Should model outputs be snapshotted as immutable artifacts?

## Takeaway

Reading about durable execution is not academic for agent builders. It is the difference between a demo that works once and a system that learns across sessions.
`;

const ATTENTION_PAPER_EXCERPT = `# Attention Is All You Need

## Abstract

The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.

## Introduction

Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation.

## Self-Attention

Self-attention, sometimes called intra-attention, is an attention mechanism relating different positions of a single sequence in order to compute a representation of the sequence. Self-attention has been used successfully in a variety of tasks including reading comprehension, abstractive summarization, textual entailment and learning task-independent sentence representations.

## Scaled Dot-Product Attention

We call our particular attention "Scaled Dot-Product Attention". The input consists of queries and keys of dimension d_k, and values of dimension d_v. We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function to obtain the weights on the values.

## Multi-Head Attention

Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d_k, d_k and d_v dimensions, respectively.

## Positional Encoding

Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence.

## Results

On the WMT 2014 English-to-German translation task, the Transformer achieves 28.4 BLEU, improving over the existing best results, including ensembles, by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state of the art BLEU score of 41.8.

## Takeaway

Attention is all you need — the Transformer replaced recurrence with parallel self-attention and became the foundation for GPT, BERT, and modern LLM stacks.
`;
