// builds the OpenAPI spec from the JSDoc @openapi comments on each route
import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Search Tool + Light RAG KB API",
      version: "1.0.0",
      description:
        "Router-based web/direct search pipeline plus an in-memory RAG knowledge base (ingest + ask).",
    },
    servers: [{ url: `http://localhost:${env.PORT}` }],
    components: {
      schemas: {
        ChatMessage: {
          type: "object",
          required: ["role", "content"],
          properties: {
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string", minLength: 1 },
          },
        },
        SearchInput: {
          type: "object",
          required: ["q"],
          properties: {
            q: {
              type: "string",
              minLength: 5,
              example: "What is LangChain?",
            },
            history: {
              type: "array",
              maxItems: 20,
              default: [],
              items: { $ref: "#/components/schemas/ChatMessage" },
            },
          },
        },
        SearchAnswer: {
          type: "object",
          required: ["answer", "sources"],
          properties: {
            answer: { type: "string" },
            sources: {
              type: "array",
              items: { type: "string", format: "uri" },
            },
          },
        },
        IngestTextRequest: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string", minLength: 1 },
            source: {
              type: "string",
              minLength: 1,
              description: "Defaults to an auto-generated 'pasted-text-N' name",
            },
          },
        },
        IngestResult: {
          type: "object",
          required: ["docCount", "chunkCount", "source"],
          properties: {
            docCount: { type: "integer", example: 1 },
            chunkCount: { type: "integer", example: 5 },
            source: { type: "string" },
          },
        },
        AskKBRequest: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              minLength: 1,
              example: "What is the refund window?",
            },
            k: {
              type: "integer",
              minimum: 1,
              maximum: 20,
              default: 4,
              description: "Number of nearest chunks to retrieve",
            },
          },
        },
        KBSource: {
          type: "object",
          required: ["source", "chunkId"],
          properties: {
            source: { type: "string" },
            chunkId: { type: "string" },
          },
        },
        KBAskResult: {
          type: "object",
          required: ["answer", "sources", "cofidence"],
          properties: {
            answer: { type: "string" },
            sources: {
              type: "array",
              items: { $ref: "#/components/schemas/KBSource" },
            },
            cofidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Top match's cosine similarity, 0 when no chunks matched",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } },
        },
      },
    },
  },
  apis: [path.join(__dirname, "../routes/*.ts"), path.join(__dirname, "../index.ts")],
});

export default swaggerSpec;
