export type AnthropicFeedSource = "research" | "engineering";

export interface AnthropicFeedLink {
  id: string;
  title: string;
  url: string;
  source: AnthropicFeedSource;
  published_at: string | null;
  fetched_at: string;
}

export interface AnthropicFetchResult {
  added: number;
  updated: number;
  total: number;
  sources: Record<AnthropicFeedSource, number>;
  fetched_at: string;
  method: "rss" | "html";
  errors: string[];
}
