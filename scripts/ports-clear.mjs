#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { PORTS } from "./lib/ports.mjs";
import {
  freePort,
  getListeners,
  getProcessArgs,
  getUniqueListenerPids,
} from "./lib/port-utils.mjs";

const steps = [];

async function clearPort(port, label) {
  const listeners = getListeners(port);
  if (listeners.length === 0) {
    steps.push(`${label} (port ${port}): already free`);
    return;
  }

  console.log(`\nClearing ${label} (port ${port})...`);
  for (const { pid, user, command } of listeners) {
    console.log(`  found PID ${pid} (${user}) ${command}: ${getProcessArgs(pid)}`);
  }

  const result = await freePort(port, { timeoutMs: 8000, label });
  const remaining = getUniqueListenerPids(port);

  if (result.ok && remaining.length === 0) {
    steps.push(`${label} (port ${port}): cleared (${result.killed.length} process(es))`);
    return;
  }

  steps.push(`${label} (port ${port}): still in use (${remaining.join(", ") || "unknown"})`);
}

function stopLapdog() {
  console.log("\nStopping Lapdog agent...");
  const result = spawnSync("lapdog", ["stop"], {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status === 0) {
    steps.push("Lapdog: stopped via `lapdog stop`");
  } else if (result.stderr?.includes("not running") || result.stdout?.includes("not running")) {
    steps.push("Lapdog: was not running");
  } else {
    steps.push("Lapdog: `lapdog stop` attempted");
  }
}

function stopClickHouse() {
  console.log("\nStopping ClickHouse (docker compose down)...");
  const result = spawnSync("docker", ["compose", "down"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status === 0) {
    steps.push("ClickHouse: docker compose down");
  } else {
    steps.push("ClickHouse: docker compose down failed (is Docker running?)");
  }
}

console.log("MyReader — clearing all dev ports");

await clearPort(PORTS.app, "Next.js app");
stopLapdog();
await clearPort(PORTS.lapdog, "Lapdog trace agent");
stopClickHouse();
await clearPort(PORTS.clickhouseHttp, "ClickHouse HTTP");
await clearPort(PORTS.clickhouseNative, "ClickHouse native");

console.log("\nSummary:");
for (const line of steps) {
  console.log(`  • ${line}`);
}

console.log("\nStart fresh with: npm run dev:all");

const blocked = [PORTS.app, PORTS.lapdog, PORTS.clickhouseHttp, PORTS.clickhouseNative].filter(
  (port) => getUniqueListenerPids(port).length > 0
);

if (blocked.length > 0) {
  console.error(`\nSome ports still in use: ${blocked.join(", ")}`);
  console.error("Run `npm run ports:check` for details.");
  process.exit(1);
}
