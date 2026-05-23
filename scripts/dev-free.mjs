#!/usr/bin/env node
import { PORTS } from "./lib/ports.mjs";
import {
  freePort,
  getListeners,
  getProcessArgs,
  waitForPortFree,
} from "./lib/port-utils.mjs";

const port = PORTS.app;
const listeners = getListeners(port);

if (listeners.length === 0) {
  console.log(`Port ${port} is free.`);
  process.exit(0);
}

console.log(`Freeing port ${port} (all listeners + parent process tree)...`);
for (const { pid, user, command } of listeners) {
  console.log(`  listener PID ${pid} (${user}) ${command}: ${getProcessArgs(pid)}`);
}

const result = await freePort(port, {
  timeoutMs: 8000,
  label: `Next.js app port ${port}`,
});

const free = await waitForPortFree(port, { timeoutMs: 2000 });
if (!result.ok || !free) {
  const remaining = getListeners(port);
  console.error(`\nPort ${port} is still in use after cleanup:`);
  for (const { pid, user, command } of remaining) {
    console.error(`  PID ${pid} (${user}) ${command}: ${getProcessArgs(pid)}`);
  }
  console.error(`\nRun \`npm run ports:clear\` to reset all MyReader ports.`);
  process.exit(1);
}

console.log(`Port ${port} is ready.`);
