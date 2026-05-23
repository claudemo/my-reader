import { isSemiontConfigured } from "./client";

export type SemiontMode = "live" | "local-only";

export async function getSemiontStatus(): Promise<{
  mode: SemiontMode;
  configured: boolean;
  base_url: string | null;
  reachable: boolean;
  message: string;
}> {
  const base = process.env.SEMIONT_BASE_URL?.replace(/\/$/, "") ?? null;

  if (!base) {
    return {
      mode: "local-only",
      configured: false,
      base_url: null,
      reachable: false,
      message:
        "Semiont not configured. MyReader still saves W3C-style annotations locally in SQLite.",
    };
  }

  try {
    const res = await fetch(`${base}/api/openapi.json`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return {
        mode: "live",
        configured: true,
        base_url: base,
        reachable: true,
        message: "Connected to Semiont. Highlights sync to the Semiont knowledge graph.",
      };
    }
  } catch {
    /* fall through */
  }

  return {
    mode: "local-only",
    configured: isSemiontConfigured(),
    base_url: base,
    reachable: false,
    message: `SEMIONT_BASE_URL is set (${base}) but server is not reachable. Using local annotations only.`,
  };
}
