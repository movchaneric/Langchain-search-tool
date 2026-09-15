# Search Tool + Light RAG KB

A LangChain-powered agent with two independent pipelines, plus a Next.js client for both:

- **`agent/`** — Express + LangChain backend. Two pipelines live side by side: a web/direct **search** pipeline (`src/search_tool/`) and an in-memory **Light RAG** knowledge base (`src/light_rag_kb/`). API docs for every route: `GET /docs` (Swagger UI) or `GET /docs.json` (raw OpenAPI spec).
- **`client/`** — Next.js UI: a chat-style search page (`/`) and a Knowledge Base page (`/kb`, `/kb/chunks`) for ingesting text and asking questions against it.

## Flow 1 — Search Pipeline

`POST /api/search` — routes a query to either a direct LLM answer or a live web search, then validates the result before returning it.

**Diagram:** https://excalidraw.com/#json=FuHm6eCH5mq12f8KFoD_5,6I0qeQCF399p9FQZBW1n9Q

1. **User Query** — the client sends `{ q, history }` to `POST /api/search`.
2. **Router** — `routeStrategy` inspects the query (length, recent-year mentions, keywords like "best", "vs", "price", "latest") and decides `direct` or `web` mode.
3. **Direct Answer** *(direct branch)* — the LLM answers straight from its own knowledge, using the chat history for follow-up context.
4. **Web Search** *(web branch)* — Tavily is queried for the top results matching `q`.
5. **Open & Summarize** — the top 5 result pages are fetched and each one is summarized; if every fetch fails, it falls back to the search snippets, and if there are no results at all, it falls back to the Direct Answer step instead.
6. **Compose Answer** — the LLM writes the final answer using only the page summaries, never inventing facts beyond them.
7. **Validate & Polish** — the candidate `{ answer, sources }` shape is checked against the schema, and if malformed, a second LLM call repairs it.
8. **Response** — the validated `{ answer, sources }` is returned to the client and rendered as a chat bubble with source links.

## Flow 2 — Light RAG Knowledge Base

Two paths share one in-memory vector store: one adds documents, the other answers questions grounded in them.

**Diagram:** https://excalidraw.com/#json=sI46Wj22bzbkhHkJ1Yc7Q,qvswQAzA4vxKWwsTgeetDg

### Ingest Path — `POST /api/kb/ingest`
1. **Add Text** — the client submits raw text plus an optional source label.
2. **Chunk Text** — the text is normalized and split into ~250-token pieces with a 40-token overlap.
3. **Embed Chunks** — each chunk is embedded via the configured provider (OpenAI or Gemini).
4. **Store in Memory** — the chunks and their vectors are upserted into the `MemoryVectorStore`, replacing any older chunks from the same source.

### Ask Path — `POST /api/kb/ask`
1. **User Question** — the client submits a query plus an optional `k` (how many chunks to retrieve).
2. **Embed Query** — the question is embedded via the same provider's query-tasked embedder.
3. **Similarity Search** — cosine similarity ranks every stored chunk against the query, reading from the same store the Ingest path writes to, and returns the top `k`.
4. **Build Context** — the retrieved chunks are formatted into a labeled excerpt block (source, chunk id, similarity score).
5. **Grounded Answer** — the LLM answers strictly from those excerpts, saying "I don't know" rather than guessing if nothing relevant was found.
6. **Response + Sources + Confidence** — the answer, the per-chunk sources, and the top match's similarity score are returned to the client.

Inspect what's currently ingested at any time via `GET /api/kb/chunks` or the `/kb/chunks` client page, and wipe the store with `POST /api/kb/reset`.
