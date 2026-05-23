import { runAnthropicFeedAgent } from "../src/lib/agents/anthropic-feed-agent";

runAnthropicFeedAgent()
  .then((result) => {
    console.log(
      `AnthropicFeedAgent: ${result.added} added, ${result.updated} updated (${result.total} total, method=${result.method})`
    );
    if (result.errors.length > 0) {
      console.warn("Warnings:", result.errors.join("; "));
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("AnthropicFeedAgent failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
