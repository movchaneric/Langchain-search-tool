// embedding + vector store
// kb brain -> KB base
// picks an embedding model -> openai or gemini
// store the embedding in ram
// letting us insert created chunks , and leter run search based on those chunks

import { TaskType } from "@google/generative-ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import type { ChunkMetadata } from "./chunk";
import { env } from "../shared/env";

// core concepts:
// Embedding models : text -> [array of nubmer ] -> vector space
// vector store: searchable index

type RagProvider = "openai" | "google";

function getProvider(): RagProvider {
  return env.RAG_MODEL_PROVIDER === "gemini" ? "google" : "openai";
}

// Create embedding client
function makeOpenAiEmbedding() {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error("OpenAI API key is missing");
  }

  return new OpenAIEmbeddings({
    apiKey: key,
    model: "text-embedding-3-small",
  });
}

// taskType is fixed at construction (no per-call override), so documents and
// queries need separate clients -- otherwise similaritySearch's embedQuery
// call would wrongly embed with RETRIEVAL_DOCUMENT.
function makeGoogleEmbedding(): EmbeddingsInterface {
  const key = process.env.GOOGLE_API_KEY;

  if (!key) {
    throw new Error("Google API key is missing");
  }

  const documentEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: key,
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    model: "gemini-embedding-001",
  });

  const queryEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: key,
    taskType: TaskType.RETRIEVAL_QUERY,
    model: "gemini-embedding-001",
  });

  return {
    embedDocuments: (texts) => documentEmbeddings.embedDocuments(texts),
    embedQuery: (text) => queryEmbeddings.embedQuery(text),
  };
}

function makeEmbedding(provider: RagProvider) {
  return provider === "google" ? makeGoogleEmbedding() : makeOpenAiEmbedding();
}

// vector store
// "this is my query" -> find me the closest chunks

let store: MemoryVectorStore | null = null;
let currentProvider: RagProvider | null = null;

export function getVectorStore(): MemoryVectorStore {
  const provider = getProvider();

  // same provider -> keep the existing store in memory
  if (store && currentProvider === provider) {
    return store;
  }

  // first call or provider changed -> different providers use different vector spaces, start fresh
  store = new MemoryVectorStore(makeEmbedding(provider));
  currentProvider = provider;

  return store;
}

// embeds chunks and adds them to the store, returns chunk count
// re-ingesting a source replaces its old chunks instead of duplicating them

// serializes upserts so concurrent calls can't both add vectors before
// either's filter step runs, which would duplicate instead of replace
let upsertQueue: Promise<unknown> = Promise.resolve();

export function upsertChunksBySource(docs: Document<ChunkMetadata>[]): Promise<number> {
  const result = upsertQueue.then(() => doUpsertChunksBySource(docs));
  upsertQueue = result.catch(() => undefined);
  return result;
}

async function doUpsertChunksBySource(docs: Document<ChunkMetadata>[]): Promise<number> {
  if (docs.length === 0) return 0;

  const store = getVectorStore();

  // embed first, so a failed API call doesn't wipe the old chunks
  const vectors = await store.embeddings.embedDocuments(
    docs.map((doc) => doc.pageContent)
  );

  const sources = new Set(docs.map((doc) => doc.metadata.source));
  store.memoryVectors = store.memoryVectors.filter(
    (vector) => !sources.has(vector.metadata.source)
  );

  await store.addVectors(vectors, docs);

  return docs.length;
}

export function resetStore() {
  store = null;
  currentProvider = null;
}

export type StoredChunk = {
  chunkId: string;
  source: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  tokenCount: number;
};

// reads the module-level store directly (not getVectorStore()) so listing
// never lazily creates an embeddings client -- an empty KB just returns []
export function listChunks(): StoredChunk[] {
  if (!store) return [];

  return store.memoryVectors.map((vector) => {
    const meta = vector.metadata as ChunkMetadata;
    return {
      chunkId: meta.chunkId,
      source: meta.source,
      content: vector.content,
      chunkIndex: meta.chunkIndex,
      totalChunks: meta.totalChunks,
      tokenCount: meta.tokenCount,
    };
  });
}
