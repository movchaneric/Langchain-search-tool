// why to chunk
// slice it
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getEncoding } from "js-tiktoken";

// sizes are measured in tokens, not characters (250 tokens ≈ 1000 chars)
export const CHUNK_SIZE = 250;
export const CHUNK_OVERLAP = 40;

const encoding = getEncoding("cl100k_base");
const countTokens = (text: string) => encoding.encode(text).length;

// markdown separators (headings, code blocks, rules) work for plain articles/policies too
const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  lengthFunction: countTokens,
});

export type ChunkMetadata = {
  source: string;
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  tokenCount: number;
};

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n") 
    .trim();
}

// text-> MD, article, policy
// source
export async function chunkText(
  text: string,
  source: string
): Promise<Document<ChunkMetadata>[]> {
  const cleaned = normalize(text);
  if (!cleaned) return [];

  const pieces = await splitter.splitText(cleaned);

  return pieces.map(
    (pageContent, chunkIndex) =>
      new Document<ChunkMetadata>({
        pageContent,
        metadata: {
          source,
          chunkId: `${source}#${chunkIndex}`,
          chunkIndex,
          totalChunks: pieces.length,
          tokenCount: countTokens(pageContent),
        },
      })
  );
}
