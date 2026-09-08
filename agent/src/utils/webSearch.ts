//search the internet tool
// you are going to give it natural language query and call tavily under the hood and return WebSearchResultSchema

import { env } from "../shared/env";
import { WebSearchResultsSchema, type WebSearchResults } from "./schemas";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export async function webSearchTool(query: string): Promise<WebSearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("webSearch: query must not be empty");
  }

  switch (env.SEARCH_PROVIDER) {
    case "tavily":
      return searchWithTavily(trimmed);
    default:
      throw new Error(`Unsupported SEARCH_PROVIDER: ${env.SEARCH_PROVIDER}`);
  }
}

async function searchWithTavily(query: string): Promise<WebSearchResults> {
  if (!env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  const res = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      max_results: 5,
      search_depth: "basic",
      include_images: false,
    }),
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`Tavily error, ${res.status} - ${text}`);
  }

  const data = (await res.json()) as {
    results: Array<{ title: string; url: string; content?: string }>;
  };

  const results = data.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content ?? "",
  }));

  return WebSearchResultsSchema.parse(results);
}

async function safeText(res: Response) {
  try {
    return res.json();
  } catch (err) {
    return "<no body>";
  }
}
