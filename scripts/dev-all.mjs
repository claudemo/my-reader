#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { PORTS, clickhouseUrl, lapdogAgentUrl } from "./lib/ports.mjs";
import { getListeners, waitForHttp } from "./lib/port-utils.mjs";

const withLapdog = process.argv.includes("--lapdog");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function step(label) {
  console.log(`\n▶ ${label}`);
}

step("Starting ClickHouse (docker compose)");
run("node", ["scripts/clickhouse-up.mjs"]);

const chPing = `${clickhouseUrl()}/ping`;
step(`Waiting for ClickHouse at ${chPing}`);
const chReady = await waitForHttp(chPing, { timeoutMs: 90_000 });
if (!chReady) {
  console.error("ClickHouse did not become ready. Run `docker compose logs clickhouse`.");
  process.exit(1);
}
console.log("ClickHouse is ready.");

if (withLapdog) {
  const lapdogPort = PORTS.lapdog;
  const lapdogUp = getListeners(lapdogPort).length > 0;

  if (!lapdogUp) {
    step("Starting Lapdog agent");
    run("lapdog", ["start"]);
  } else {
    console.log(`Lapdog already listening on port ${lapdogPort}.`);
  }

  const lapdogInfo = `${lapdogAgentUrl()}/info`;
  step(`Waiting for Lapdog at ${lapdogInfo}`);
  const lapdogReady = await waitForHttp(lapdogInfo, { timeoutMs: 30_000 });
  if (!lapdogReady) {
    console.error("Lapdog did not become ready. Run `npm run lapdog:status`.");
    process.exit(1);
  }
  console.log("Lapdog is ready.");
}

step(`Freeing app port ${PORTS.app} if needed`);
run("node", ["scripts/dev-free.mjs"]);

step(`Starting Next.js on port ${PORTS.app}${withLapdog ? " (with Lapdog tracing)" : ""}`);

const devEnv = { ...process.env };
if (withLapdog) {
  devEnv.DD_LLMOBS_ENABLED = "1";
  devEnv.DD_LLMOBS_ML_APP = devEnv.DD_LLMOBS_ML_APP ?? "myreader";
  devEnv.DD_TRACE_AGENT_URL = lapdogAgentUrl();
  devEnv.DD_ENV = devEnv.DD_ENV ?? "development";
  devEnv.DD_SERVICE = devEnv.DD_SERVICE ?? "myreader";
}

const child = withLapdog
  ? spawn("lapdog", ["node", "scripts/dev.mjs"], {
      stdio: "inherit",
      env: devEnv,
      shell: process.platform === "win32",
    })
  : spawn("node", ["scripts/dev.mjs"], {
      stdio: "inherit",
      env: devEnv,
    });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
