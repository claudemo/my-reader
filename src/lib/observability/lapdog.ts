import type { LlmProvider } from "@/lib/llm/client";
import {
  getLapdogLocalId,
  getLapdogSessionId,
} from "@/lib/observability/lapdog-local-id";

export { getLapdogLocalId, getLapdogSessionId };

export interface LapdogTraceContext {
  sessionId?: string;
  agentName?: string;
}

export function isLapdogEnabled(): boolean {
  return process.env.DD_LLMOBS_ENABLED === "1";
}

export function getLapdogDashboardUrl(): string {
  return process.env.LAPDOG_DASHBOARD_URL ?? "https://lapdog.datadoghq.com";
}

export function getLapdogAgentUrl(): string {
  return process.env.DD_TRACE_AGENT_URL ?? "http://127.0.0.1:8126";
}

function resolveSessionId(traceId?: string): string | undefined {
  if (!traceId) return getLapdogLocalId();
  return getLapdogSessionId(traceId);
}

function getLlmObs() {
  if (!isLapdogEnabled()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tracer = require("dd-trace") as typeof import("dd-trace");
    return tracer.llmobs?.enabled ? tracer.llmobs : null;
  } catch {
    return null;
  }
}

export async function pingLapdogAgent(): Promise<boolean> {
  try {
    const res = await fetch(`${getLapdogAgentUrl()}/info`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function traceAgent<T>(
  name: string,
  sessionId: string | undefined,
  fn: () => Promise<T> | T,
  metadata?: Record<string, unknown>
): Promise<T> {
  const llmobs = getLlmObs();
  if (!llmobs) return Promise.resolve(fn());

  const localId = getLapdogLocalId();
  return llmobs.trace({ kind: "agent", name, sessionId: resolveSessionId(sessionId) }, (span) => {
    llmobs.annotate(span, {
      metadata: { ...metadata, lapdog_local_id: localId },
      tags: { service: "myreader", agent: name, lapdog_local_id: localId },
    });
    return fn();
  });
}

export async function traceLlm<T>(
  opts: {
    name: string;
    sessionId?: string;
    provider: LlmProvider;
    model: string;
    system: string;
    user: string;
  },
  fn: () => Promise<T> | T
): Promise<T> {
  const llmobs = getLlmObs();
  if (!llmobs) return Promise.resolve(fn());

  const localId = getLapdogLocalId();

  return llmobs.trace(
    {
      kind: "llm",
      name: opts.name,
      sessionId: resolveSessionId(opts.sessionId),
      modelName: opts.model,
      modelProvider: opts.provider === "none" ? "custom" : opts.provider,
    },
    (span) => {
      llmobs.annotate(span, {
        inputData: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        metadata: { lapdog_local_id: localId },
        tags: {
          service: "myreader",
          agent: opts.name,
          lapdog_local_id: localId,
        },
      });

      return Promise.resolve(fn()).then(
        (result) => {
          if (typeof result === "string") {
            llmobs.annotate(span, {
              outputData: [{ role: "assistant", content: result.slice(0, 4000) }],
            });
          }
          return result;
        },
        (error) => {
          llmobs.annotate(span, {
            metadata: { error: error instanceof Error ? error.message : "unknown" },
          });
          throw error;
        }
      );
    }
  );
}

export async function traceWorkflow<T>(
  name: string,
  sessionId: string | undefined,
  fn: () => Promise<T> | T,
  metadata?: Record<string, unknown>
): Promise<T> {
  const llmobs = getLlmObs();
  if (!llmobs) return Promise.resolve(fn());

  return llmobs.trace({ kind: "workflow", name, sessionId: resolveSessionId(sessionId) }, (span) => {
    llmobs.annotate(span, {
      metadata: { ...metadata, lapdog_local_id: getLapdogLocalId() },
    });
    return fn();
  });
}
