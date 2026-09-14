// ingestion pipeline: text -> chunks -> embeddings -> memory store
// returns a summary so the UI can say "added 1 document with N chunks from <source>"

import { chunkText } from "./chunk";
import { upsertChunksBySource } from "./store";

export type IngestTextInput = {
  text: string;
  source?: string;
};

export type IngestResult = {
  docCount: number;
  chunkCount: number;
  source: string;
};

// the store replaces chunks by source, so unnamed pastes each need their own name
// (counter resets on restart, same as the in-memory store)
let pastedCount = 0;

export async function ingestText(input: IngestTextInput): Promise<IngestResult> {
  const raw = (input.text ?? "").trim();

  if (!raw) {
    throw new Error("No text to ingest");
  }

  const source = input.source?.trim() || `pasted-text-${++pastedCount}`;

  const docs = await chunkText(raw, source);

  // embed each chunk and add it to the vector store
  const chunkCount = await upsertChunksBySource(docs);

  return {
    docCount: 1,
    chunkCount,
    source,
  };
}
