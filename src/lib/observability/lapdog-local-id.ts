import fs from "fs";
import path from "path";
import crypto from "crypto";

const ID_FILE = path.join(process.cwd(), "data", "lapdog-local-id");

function generateLocalId(): string {
  return `myreader-${crypto.randomBytes(4).toString("hex")}`;
}

export function getLapdogLocalId(): string {
  const fromEnv = process.env.LAPDOG_LOCAL_ID?.trim();
  if (fromEnv) return fromEnv;

  try {
    if (fs.existsSync(ID_FILE)) {
      const stored = fs.readFileSync(ID_FILE, "utf-8").trim();
      if (stored) return stored;
    }
  } catch {
    /* fall through */
  }

  const id = generateLocalId();
  try {
    fs.mkdirSync(path.dirname(ID_FILE), { recursive: true });
    fs.writeFileSync(ID_FILE, `${id}\n`, "utf-8");
  } catch {
    /* best effort */
  }
  return id;
}

export function getLapdogSessionId(traceId: string): string {
  return `${getLapdogLocalId()}:${traceId}`;
}
