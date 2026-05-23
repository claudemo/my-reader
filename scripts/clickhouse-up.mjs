#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { PORTS } from "./lib/ports.mjs";

loadEnvFiles();

const env = {
  ...process.env,
  CLICKHOUSE_HTTP_PORT: String(PORTS.clickhouseHttp),
  CLICKHOUSE_NATIVE_PORT: String(PORTS.clickhouseNative),
};

const result = spawnSync("docker", ["compose", "up", "-d"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
