import { API_URL } from "./config";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type SearchAnswer = {
  answer: string;
  sources: string[];
};

export async function search(
  query: string,
  history: ChatMessage[] = []
): Promise<SearchAnswer> {
  const res = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, history }),
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Search request failed (${res.status})`);
  }

  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `Search request failed (${res.status})`;
    throw new Error(message);
  }

  return data as SearchAnswer;
}
