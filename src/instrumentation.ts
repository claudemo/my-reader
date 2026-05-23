export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DD_LLMOBS_ENABLED === "1") {
    await import("dd-trace/initialize.mjs");
  }
}
