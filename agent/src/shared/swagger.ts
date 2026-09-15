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
        KBChunk: {
          type: "object",
          required: [
            "chunkId",
            "source",
            "content",
            "chunkIndex",
            "totalChunks",
            "tokenCount",
          ],
          properties: {
            chunkId: { type: "string" },
            source: { type: "string" },
            content: { type: "string" },
            chunkIndex: { type: "integer" },
            totalChunks: { type: "integer" },
            tokenCount: { type: "integer" },
          },
        },
      },
    },
    // light_rag_router.ts and index.ts routes are kept comment-free, so their paths are declared here instead
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          tags: ["System"],
          responses: {
            "200": {
              description: "Service is up",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok"],
                    properties: { ok: { type: "boolean", example: true } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/kb/chunks": {
        get: {
          summary: "List every chunk currently sitting in the in-memory knowledge base",
          tags: ["Knowledge Base"],
          responses: {
            "200": {
              description: "All ingested chunks",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["chunks"],
                    properties: {
                      chunks: {
                        type: "array",
                        items: { $ref: "#/components/schemas/KBChunk" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/kb/ingest": {
        post: {
          summary: "Chunk + embed text and add it to the in-memory knowledge base",
          tags: ["Knowledge Base"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/IngestTextRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Ingestion summary",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/IngestResult" },
                },
              },
            },
            "400": {
              description: "Invalid input",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/kb/ask": {
        post: {
          summary: "Retrieve relevant chunks and answer the question grounded on them",
          tags: ["Knowledge Base"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AskKBRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Grounded answer with per-chunk sources and a confidence score",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/KBAskResult" },
                },
              },
            },
            "400": {
              description: "Invalid input",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/kb/reset": {
        post: {
          summary: "Drop the in-memory vector store (dev/testing utility)",
          tags: ["Knowledge Base"],
          responses: {
            "200": {
              description: "Store cleared",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok"],
                    properties: { ok: { type: "boolean", example: true } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, "../routes/*.ts"), path.join(__dirname, "../index.ts")],
});

export default swaggerSpec;
