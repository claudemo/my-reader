#!/usr/bin/env node
import { spawn } from "node:child_process";
import { PORTS } from "./lib/ports.mjs";

const port = PORTS.app;
const child = spawn("npx", ["next", "dev", "-p", String(port)], {
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
