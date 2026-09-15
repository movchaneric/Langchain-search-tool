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

  return parseJsonOrThrow<SearchAnswer>(res, "Search request failed");
}

export type KBSource = {
  source: string;
  chunkId: string;
};

export type IngestResult = {
  docCount: number;
  chunkCount: number;
  source: string;
};

export type KBAskResult = {
  answer: string;
  sources: KBSource[];
  cofidence: number;
};

export async function ingestKB(
  text: string,
  source?: string
): Promise<IngestResult> {
  const res = await fetch(`${API_URL}/api/kb/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source }),
  });

  return parseJsonOrThrow<IngestResult>(res, "Ingest request failed");
}

export async function askKB(query: string, k?: number): Promise<KBAskResult> {
  const res = await fetch(`${API_URL}/api/kb/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, k }),
  });

  return parseJsonOrThrow<KBAskResult>(res, "Ask request failed");
}

export type KBChunk = {
  chunkId: string;
  source: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  tokenCount: number;
};

export async function listKBChunks(): Promise<KBChunk[]> {
  const res = await fetch(`${API_URL}/api/kb/chunks`);
  const data = await parseJsonOrThrow<{ chunks: KBChunk[] }>(
    res,
    "List chunks request failed"
  );
  return data.chunks;
}

async function parseJsonOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`${fallbackMessage} (${res.status})`);
  }

  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `${fallbackMessage} (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
