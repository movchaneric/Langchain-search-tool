import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import { getVectorStore } from "./store";
import { getChatModel } from "../shared/models";
import type { ChunkMetadata } from "./chunk";

export type KBSource = {
  source: string;
  chunkId: string;
};

export type KBAskResult = {
  answer: string;
  sources: KBSource[];
  cofidence: number; // 0 - 1
};

const NO_MATCH_ANSWER = "I don't know -- the knowledge base has nothing relevant to that.";

export async function askKB(query: string, k = 4): Promise<KBAskResult> {
  const validateCurrentQuery = (query ?? "").trim();
  // e.g. "what is the refund window?" -- same string, just trimmed of whitespace

  if (!validateCurrentQuery) {
    throw new Error("askKB Query is missing try again ");
  }

  const store = getVectorStore();
  // MemoryVectorStore instance holding every ingested chunk's embedding

  const matches = await store.similaritySearchWithScore(validateCurrentQuery, k);
  // [
  //   [Document{ pageContent: "Refunds are available...", metadata: { source: "policy.md", chunkId: "policy.md#2", ... } }, 0.87],
  //   [Document{ pageContent: "...", metadata: {...} }, 0.81],
  //   ... up to k entries, sorted highest similarity first
  // ]

  if (matches.length === 0) {
    return { answer: NO_MATCH_ANSWER, sources: [], cofidence: 0 };
    // e.g. { answer: "I don't know -- the knowledge base has nothing relevant to that.", sources: [], cofidence: 0 }
  }

  const context = matches
    .map(([doc, score], i) => {
      const meta = doc.metadata as ChunkMetadata;
      // e.g. meta = { source: "policy.md", chunkId: "policy.md#2", chunkIndex: 2, totalChunks: 5, tokenCount: 180 }
      return `[${i + 1}] (source: ${meta.source}, chunk: ${meta.chunkId}, similarity: ${score.toFixed(3)})\n${doc.pageContent}`;
      // e.g. "[1] (source: policy.md, chunk: policy.md#2, similarity: 0.870)\nRefunds are available within 30 days..."
    })
    .join("\n\n");
  // e.g. "[1] (source: policy.md, chunk: policy.md#2, similarity: 0.870)\nRefunds...\n\n[2] (source: policy.md, chunk: policy.md#0, similarity: 0.810)\n..."

  return generateGroundedAnswer(validateCurrentQuery, matches, context);
}

// calls the LLM grounded on the retrieved chunks, then shapes the final KBAskResult
async function generateGroundedAnswer(
  query: string,
  matches: [Document, number][],
  context: string,
): Promise<KBAskResult> {
  const model = getChatModel({ temperature: 0.2 });
  // e.g. a ChatGoogleGenerativeAI (or ChatOpenAI/ChatGroq) instance, not yet called

  const res = await model.invoke([
    new SystemMessage(
      [
        "You answer questions using ONLY the knowledge base excerpts provided below.",
        "Rules:",
        " - Base the answer strictly on the excerpts, never on outside knowledge",
        " - If the excerpts don't contain the answer, say you don't know instead of guessing",
        " - Be concise: 3 to 6 sentences",
        " - Do not invent sources",
      ].join("\n"),
    ),
    new HumanMessage(
      [`QUESTION: ${query}`, "", "KNOWLEDGE BASE EXCERPTS:", context].join("\n"),
    ),
  ]);
  // e.g. res = AIMessage{ content: "Refunds are available within 30 days of purchase, provided the item is unused..." }

  const answer = (
    typeof res.content === "string" ? res.content : String(res.content)
  ).trim();
  // e.g. "Refunds are available within 30 days of purchase, provided the item is unused..."

  const sources: KBSource[] = matches.map(([doc]) => {
    const meta = doc.metadata as ChunkMetadata;
    return { source: meta.source, chunkId: meta.chunkId };
  });
  // e.g. [ { source: "policy.md", chunkId: "policy.md#2" }, { source: "policy.md", chunkId: "policy.md#0" } ]

  // top match's cosine similarity as a rough confidence signal
  const cofidence = Math.max(0, Math.min(1, matches[0][1]));
  // e.g. 0.87 (clamped into the 0-1 range)

  return { answer, sources, cofidence };
  // e.g. {
  //   answer: "Refunds are available within 30 days of purchase, provided the item is unused...",
  //   sources: [ { source: "policy.md", chunkId: "policy.md#2" }, { source: "policy.md", chunkId: "policy.md#0" } ],
  //   cofidence: 0.87
  // }
}
