import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();

function readPort(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid ${name}=${raw} (expected 1–65535)`);
  }
  return parsed;
}

export const PORTS = {
  app: readPort("PORT", 3001),
  clickhouseHttp: readPort("CLICKHOUSE_HTTP_PORT", 8123),
  clickhouseNative: readPort("CLICKHOUSE_NATIVE_PORT", 9000),
  lapdog: readPort("LAPDOG_PORT", 8126),
};

export function appUrl() {
  return process.env.APP_URL ?? `http://localhost:${PORTS.app}`;
}

export function clickhouseUrl() {
  return process.env.CLICKHOUSE_URL ?? `http://localhost:${PORTS.clickhouseHttp}`;
}

export function lapdogAgentUrl() {
  return process.env.DD_TRACE_AGENT_URL ?? `http://127.0.0.1:${PORTS.lapdog}`;
}

/** Human-readable registry of MyReader-related ports. */
export const PORT_REGISTRY = [
  {
    key: "PORT",
    port: () => PORTS.app,
    service: "Next.js app",
    env: "PORT",
    url: () => appUrl(),
  },
  {
    key: "CLICKHOUSE_HTTP_PORT",
    port: () => PORTS.clickhouseHttp,
    service: "ClickHouse HTTP",
    env: "CLICKHOUSE_HTTP_PORT / CLICKHOUSE_URL",
    url: () => clickhouseUrl(),
  },
  {
    key: "CLICKHOUSE_NATIVE_PORT",
    port: () => PORTS.clickhouseNative,
    service: "ClickHouse native",
    env: "CLICKHOUSE_NATIVE_PORT",
    url: () => `tcp://localhost:${PORTS.clickhouseNative}`,
  },
  {
    key: "LAPDOG_PORT",
    port: () => PORTS.lapdog,
    service: "Lapdog trace agent",
    env: "LAPDOG_PORT / DD_TRACE_AGENT_URL",
    url: () => lapdogAgentUrl(),
  },
];
