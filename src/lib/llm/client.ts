import { traceLlm } from "@/lib/observability/lapdog";

export type LlmProvider = "openai" | "openrouter" | "gemini" | "nvidia" | "none";

export interface CompleteOptions {
  system: string;
  user: string;
  maxTokens?: number;
  sessionId?: string;
  agentName?: string;
}

function providerHasKey(provider: LlmProvider): boolean {
  switch (provider) {
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "nvidia":
      return Boolean(process.env.NVIDIA_API_KEY);
    default:
      return false;
  }
}

export function getActiveProvider(): LlmProvider {
  const preferred = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (preferred === "openrouter" || preferred === "gemini" || preferred === "openai" || preferred === "nvidia") {
    if (providerHasKey(preferred)) return preferred;
  }

  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.NVIDIA_API_KEY) return "nvidia";
  return "none";
}

export function getProviderLabel(): string {
  const p = getActiveProvider();
  if (p === "none") return "template (add API key for agentic notes)";
  return p;
}

function modelForProvider(provider: LlmProvider): string {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    case "openrouter":
      return process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001";
    case "gemini":
      return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    case "nvidia":
      return process.env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";
    default:
      return "template";
  }
}

export async function completeText(opts: CompleteOptions): Promise<string | null> {
  const provider = getActiveProvider();
  const model = modelForProvider(provider);
  const maxTokens = opts.maxTokens ?? 800;
  const agentName = opts.agentName ?? "llm_completion";

  const run = () => completeTextInner(provider, model, opts, maxTokens);

  if (provider === "none") return run();

  return traceLlm(
    {
      name: agentName,
      sessionId: opts.sessionId,
      provider,
      model,
      system: opts.system,
      user: opts.user,
    },
    run
  );
}

async function completeTextInner(
  provider: LlmProvider,
  model: string,
  opts: CompleteOptions,
  maxTokens: number
): Promise<string | null> {
  try {
    if (provider === "openai") {
      return callOpenAiCompatible(
        "https://api.openai.com/v1/chat/completions",
        process.env.OPENAI_API_KEY!,
        model,
        opts,
        maxTokens
      );
    }
    if (provider === "openrouter") {
      return callOpenAiCompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        process.env.OPENROUTER_API_KEY!,
        model,
        opts,
        maxTokens,
        {
          "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3001",
          "X-Title": "MyReader Agent",
        }
      );
    }
    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY!;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${opts.system}\n\n${opts.user}` }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    }
    if (provider === "nvidia") {
      return callOpenAiCompatible(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        process.env.NVIDIA_API_KEY!,
        model,
        opts,
        maxTokens
      );
    }
  } catch {
    return null;
  }
  return null;
}

async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  opts: CompleteOptions,
  maxTokens: number,
  extraHeaders?: Record<string, string>
): Promise<string | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

export async function completeJson<T>(opts: CompleteOptions): Promise<T | null> {
  const text = await completeText({
    ...opts,
    user: `${opts.user}\n\nRespond with valid JSON only, no markdown fences.`,
  });
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```json?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
