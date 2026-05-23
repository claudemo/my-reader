import { execSync } from "node:child_process";

/** @returns {{ pid: number, user: string, command: string }[]} */
export function getListeners(port) {
  try {
    const out = execSync(`lsof -i :${port} -sTCP:LISTEN -P -n`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const rows = [];
    for (const line of out.trim().split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const command = parts[0];
      const pid = Number.parseInt(parts[1], 10);
      const user = parts[2] ?? "";
      if (!Number.isFinite(pid)) continue;
      rows.push({ pid, user, command });
    }
    return rows;
  } catch {
    return [];
  }
}

export function getProcessArgs(pid) {
  try {
    return execSync(`ps -p ${pid} -ww -o args=`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function getProcessCwd(pid) {
  try {
    const out = execSync(`lsof -p ${pid}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const line = out.split("\n").find((row) => /\bcwd\b/.test(row));
    if (!line) return "";
    const parts = line.trim().split(/\s+/);
    return parts[parts.length - 1] ?? "";
  } catch {
    return "";
  }
}

/** True when the listener looks like a stale Next.js dev server for this repo. */
export function isStaleNextDev(pid, cwd = process.cwd()) {
  const args = getProcessArgs(pid);
  const lower = args.toLowerCase();
  const cwdLower = cwd.toLowerCase();

  if (
    lower.includes("next dev") ||
    lower.includes("next-server") ||
    (lower.includes("next") && lower.includes("dev"))
  ) {
    return true;
  }

  const procCwd = getProcessCwd(pid).toLowerCase();
  if (procCwd && procCwd.includes(cwdLower)) {
    return true;
  }

  return lower.includes("my-reader") && lower.includes("next");
}

export function getUniqueListenerPids(port) {
  const pids = getListeners(port).map((row) => row.pid);
  return [...new Set(pids)];
}

export function getChildPids(pid) {
  try {
    const out = execSync(`pgrep -P ${pid}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter(Number.isFinite);
  } catch {
    return [];
  }
}

export function getParentPid(pid) {
  try {
    const out = execSync(`ps -p ${pid} -o ppid=`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const ppid = Number.parseInt(out, 10);
    return Number.isFinite(ppid) && ppid > 1 ? ppid : null;
  } catch {
    return null;
  }
}

/** Collect listener PIDs plus parent npm/node/next processes that may respawn them. */
export function collectPortProcessTree(port) {
  const pids = new Set(getUniqueListenerPids(port));

  for (const pid of [...pids]) {
    let current = pid;
    for (let depth = 0; depth < 12; depth += 1) {
      const ppid = getParentPid(current);
      if (!ppid) break;

      const args = getProcessArgs(ppid).toLowerCase();
      if (
        args.includes("next") ||
        args.includes("npm") ||
        args.includes("npx") ||
        args.includes("node")
      ) {
        pids.add(ppid);
      }

      if (ppid === 1) break;
      current = ppid;
    }
  }

  return [...pids];
}

export function killProcessTree(pid, signal = "TERM") {
  for (const child of getChildPids(pid)) {
    killProcessTree(child, signal);
  }
  killPid(pid, signal);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runPkillFallback(port, cwd) {
  const project = cwd.split("/").pop() ?? "my-reader";
  const patterns = [
    `${project}/node_modules/.bin/next dev -p ${port}`,
    `${project}/node_modules/.bin/next dev`,
    `next dev -p ${port}`,
    `npx next dev -p ${port}`,
  ];

  for (const pattern of patterns) {
    try {
      execSync(`pkill -f ${JSON.stringify(pattern)}`, { stdio: "ignore" });
    } catch {
      // no matching processes
    }
  }
}

/**
 * Kill every process holding a TCP listener on `port`, walk up/down the tree,
 * and poll until the port is free (or timeout).
 */
export async function freePort(port, { timeoutMs = 5000, cwd = process.cwd(), label } = {}) {
  const name = label ?? `port ${port}`;
  const killed = new Set();
  const deadline = Date.now() + timeoutMs;

  const killPass = (signal) => {
    const targets = new Set([
      ...collectPortProcessTree(port),
      ...getUniqueListenerPids(port),
    ]);

    for (const pid of targets) {
      const args = getProcessArgs(pid);
      console.log(`  ${signal} PID ${pid}: ${args || "(unknown)"}`);
      killProcessTree(pid, signal);
      killed.add(pid);
    }
  };

  while (Date.now() < deadline) {
    if (getUniqueListenerPids(port).length === 0) {
      return { ok: true, killed: [...killed], remaining: [] };
    }

    killPass("TERM");
    await sleep(300);

    if (getUniqueListenerPids(port).length === 0) {
      return { ok: true, killed: [...killed], remaining: [] };
    }

    killPass("KILL");
    await sleep(300);
  }

  runPkillFallback(port, cwd);
  await sleep(400);

  const remaining = getUniqueListenerPids(port);
  return { ok: remaining.length === 0, killed: [...killed], remaining };
}

export async function waitForPortFree(port, { timeoutMs = 5000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getUniqueListenerPids(port).length === 0) return true;
    await sleep(intervalMs);
  }
  return getUniqueListenerPids(port).length === 0;
}

export function killPid(pid, signal = "TERM") {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

export async function waitForHttp(url, { timeoutMs = 60_000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
