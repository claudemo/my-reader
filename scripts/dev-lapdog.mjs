#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { lapdogAgentUrl } from "./lib/ports.mjs";
import { getListeners, waitForHttp } from "./lib/port-utils.mjs";

process.env.DD_LLMOBS_ENABLED = "1";
process.env.DD_LLMOBS_ML_APP = process.env.DD_LLMOBS_ML_APP ?? "myreader";
process.env.DD_TRACE_AGENT_URL = lapdogAgentUrl();
process.env.DD_ENV = process.env.DD_ENV ?? "development";
process.env.DD_SERVICE = process.env.DD_SERVICE ?? "myreader";

const lapdogPort = Number.parseInt(process.env.LAPDOG_PORT ?? "8126", 10);
if (getListeners(lapdogPort).length === 0) {
  console.log("Starting Lapdog agent...");
  spawnSync("lapdog", ["start"], { stdio: "inherit", shell: process.platform === "win32" });
}

const ready = await waitForHttp(`${lapdogAgentUrl()}/info`, { timeoutMs: 30_000 });
if (!ready) {
  console.error("Lapdog agent not reachable. Run `npm run lapdog:status`.");
  process.exit(1);
}

spawnSync("node", ["scripts/dev-free.mjs"], { stdio: "inherit" });

const child = spawn("lapdog", ["node", "scripts/dev.mjs"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
