#!/usr/bin/env node
import { PORT_REGISTRY } from "./lib/ports.mjs";
import { getListeners, getProcessArgs } from "./lib/port-utils.mjs";

console.log("MyReader port status\n");

for (const entry of PORT_REGISTRY) {
  const port = entry.port();
  const listeners = getListeners(port);
  const status = listeners.length === 0 ? "free" : "in use";

  console.log(`${entry.service} — port ${port} (${status})`);
  console.log(`  env: ${entry.env}`);
  console.log(`  url: ${entry.url()}`);

  for (const { pid, user, command } of listeners) {
    const args = getProcessArgs(pid);
    console.log(`  PID ${pid} (${user}) ${command}: ${args}`);
  }

  console.log("");
}

console.log("Tip: run `npm run ports:clear` to reset all MyReader ports, or `npm run dev:free` for PORT only.");
