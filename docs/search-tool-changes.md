# Search Tool — Change Summary

This document explains the files currently in the working-tree "changes area"
(`git status`) for this project: everything under `agent/src/search_tool/`,
`agent/src/shared/`, and `agent/src/utils/`. All of these are new,
untracked files that together implement a LangChain-based search agent with
two response strategies — a cheap "direct" LLM answer and a "web" search +
summarize pipeline.

The two `package-lock.json` changes (`agent/`, `client/`) are just dependency
lockfile updates from installing the packages these new files import
(`zod`, `html-to-text`, `@langchain/*`, etc.) — no logic to explain there.

## Big picture: how a query flows through the system

```
query
  │
  ▼
routeStrategy.ts   → decides "web" or "direct"
  │
  ├── mode = "direct" → directPipeline.ts        → Candidate
  │
  └── mode = "web"     → webPipeline.ts (3 steps) → Candidate
                                                        │
                                                        ▼
                                          finalValidate.ts → SearchAnswer
```

Both branches converge on the same output shape, `Candidate` (from
`types.ts`), so whatever calls this agent doesn't need to know which path
was taken. `finalValidate.ts` then sits after that as a last-mile guard that
enforces the stricter, client-facing `SearchAnswer` shape.

---

## `agent/src/search_tool/types.ts`

Defines the shared return shape both pipelines produce:

```ts
type Candidate = {
  answer: string;
  sources: string[]; // urls used, [] for the direct path
  mode: "web" | "direct";
};
```

**Purpose:** a single contract so `directPipeline` and `webPipeline` are
interchangeable from the caller's point of view.

---

## `agent/src/search_tool/routeStrategy.ts`

Decides whether a query needs a real web search ("web") or can be answered
directly by the model from its own knowledge ("direct").

Logic, in order:

1. Normalize the query (`toLowerCase().trim()`).
2. `isLongQuery` — queries over 70 characters are treated as complex enough
   to warrant a web search.
3. `recentYearRegex` — matches years `2024`–`2039` (`\b20(2[4-9]|3[0-9])\b`).
   The idea: if a query references a recent/near-future year, the model's
   training data is unlikely to be current enough, so force a web search.
4. `patterns` — a list of regexes for query *intents* that generally need
   fresh or authoritative data rather than the model's memorized knowledge:
   top-N / rankings / "best" / comparisons ("vs", "compare"), pricing
   ("cost", "under $X", currency symbols), recency ("latest", "news",
   "trending"), product lifecycle ("deprecated", "roadmap", "changelog"),
   compatibility/install questions, and "near me" queries.
5. If any of the above match, return `"web"`; otherwise `"direct"`.

`routerStep` wraps `routeStrategy` as a LangChain `RunnableLambda` so it can
be composed into an LCEL chain — it validates the input with
`SearchInputSchema` and returns `{ q, mode }`.

**Note:** the pattern list is intentionally a loose heuristic, not a strict
classifier — several regexes use bare `|` alternation without grouping
(e.g. `/\bcompare|comparison\b/u`), so the word-boundary only applies to one
side of the alternation. This is a known looseness, not a bug that was
"fixed" — left as-is since it still biases correctly toward `"web"` in the
ambiguous cases it under/over-matches.

---

## `agent/src/search_tool/directPipeline.ts`

The "cheap mode" path: no web search, no page fetching, no summarizing —
just ask the chat model directly and return its answer.

- Builds a `SystemMessage` telling the model to answer briefly, accurately,
  and to admit uncertainty rather than invent facts.
- Sends the user's question as a separate `HumanMessage`.
- Returns a `Candidate` with `sources: []` and `mode: "direct"`.

**Bug fixed here:** the `HumanMessage` was originally being passed as a
*second constructor argument* to `SystemMessage(...)` instead of as its own
message in the array. `SystemMessage` only accepts one argument, so the
actual user question was being silently dropped before ever reaching the
model. Fixed by making it a sibling entry in the messages array:
`[new SystemMessage(...), new HumanMessage(input.q)]`.

**Refactor — `getDirectAnswer(q)`:** the actual "ask the model with no
context" logic is exported as its own async function, `getDirectAnswer`,
and `directBasePath` is now a thin `RunnableLambda` wrapper around it. This
exists so `webPipeline.ts`'s `composeStep` can call the exact same function
for its own no-page-summaries fallback instead of re-implementing the same
prompt + model call a second time (see dedup note under `webPipeline.ts`
below).

---

## `agent/src/search_tool/webPipeline.ts`

The "web mode" path, built as three composable LangChain `RunnableLambda`
steps chained together with `RunnableSequence` (`wepBasePath`):

### 1. `webSearchStep`
Calls `webSearchTool(q)` (Tavily search) and attaches the raw `results` to
the pipeline input.

### 2. `openAndSummerizeStep`
For each of the top 5 results (`setTopResults = 5`):
- Fetches the page (`openUrl`)
- Summarizes its content (`summerize`)
- Uses `Promise.allSettled` so one failing page (bad URL, fetch error,
  summarization failure) doesn't abort the whole batch.

Then it filters for the `"fulfilled"` settled results and unwraps `.value`
to get the actual `{ url, summary }` objects.

Fallback logic:
- If there were no search results at all → return `pageSummeries: []`,
  `fallback: "no-results"`.
- If every page open/summarize attempt failed (extreme edge case) → fall
  back to using the raw search-result snippets/titles as pseudo-summaries
  instead, `fallback: "snippets"`.
- Otherwise → return the real summaries, `fallback: "none"`.

**Bug fixed here:** the original filter callback didn't `return` its
boolean check (`settledResult.status === "fulfilled"` was evaluated and
discarded, so the arrow function implicitly returned `undefined`, which is
falsy — meaning `.filter()` dropped *every* result no matter what).
It was also filtering the `PromiseSettledResult` wrapper objects instead of
extracting the actual value. Fixed to:
```ts
const settledResultsPageSummaries = settledResults
  .filter((settledResult) => settledResult.status === "fulfilled")
  .map((s) => s.value);
```
The step was also missing its final `return` statement entirely — it
computed `settledResultsPageSummaries` but never sent it (or anything else)
downstream. Added the `return { ...input, pageSummeries: ... }`.

### 3. `composeStep`
Takes `{ q, pageSummeries, mode, fallback }` and asks the chat model to
write the final answer:
- If there are no page summaries (shouldn't normally happen given step 2's
  fallback, but handled defensively), it delegates straight to
  `getDirectAnswer(input.q)` from `directPipeline.ts` — see the dedup note
  below.
- Otherwise, it prompts the model with the question plus the JSON-encoded
  page summaries, instructing it to answer using *only* the provided
  summaries (no invented facts), 5–8 sentences.
- Returns `{ answer, sources, mode: "web" }`, where `sources` is the list of
  URLs whose summaries were used.

**Dedup fix:** this no-page-summaries branch originally re-implemented the
exact same "ask the model with no context" call already written in
`directPipeline.ts` (same system prompt, same shape), just copy-pasted.
Replaced the whole block with a single call to the shared
`getDirectAnswer(input.q)` helper exported from `directPipeline.ts`, so
there's now one place that owns the "no context available" prompt.

**Bug fixed here (same class of bug as `directPipeline.ts`):** the
`HumanMessage` containing the question + JSON summaries was nested as a
second argument inside the `SystemMessage(...)` call instead of being a
separate message. Fixed the same way — pulled it out into its own
`HumanMessage` entry in the array. This is what caused the
`Expected 1 arguments, but got 2` TypeScript error.

### `wepBasePath`
The LCEL chain wiring the three steps together:
`webSearchStep → openAndSummerizeStep → composeStep`.

---

## `agent/src/shared/env.ts`

Central, validated environment config using `zod`:
- `PORT`, `ALLOWED_ORIGIN` — server config.
- `MODEL_PROVIDER` — which LLM backend to use (`openai` | `gemini` | `groq`),
  defaults to `gemini`.
- API keys for OpenAI/Google/Groq/Tavily (all optional at the schema level —
  only the one matching `MODEL_PROVIDER`/`SEARCH_PROVIDER` actually needs to
  be set; missing-key errors surface later where the key is used).
- Model name overrides per provider, with sane defaults.
- `SEARCH_PROVIDER` — currently only `"tavily"` is supported.

`env.parse(process.env)` runs at import time, so the app fails fast at
startup if required env vars are malformed rather than failing deep inside
a request.

---

## `agent/src/shared/models.ts`

`getChatModel(opts)` — a factory that returns a LangChain `BaseChatModel`
instance for whichever provider is configured in `env.MODEL_PROVIDER`
(OpenAI / Gemini / Groq), applying `temperature`/`maxTokens` from `opts`.

**Purpose:** every place that needs an LLM (`directPipeline`, `webPipeline`,
`summerize`) goes through this one function instead of instantiating a
provider SDK directly — swapping providers is a single env var change.

---

## `agent/src/utils/schemas.ts`

`zod` schemas/types used across the tool for input/output validation:
- `WebSearchResultSchema` / `WebSearchResultsSchema` — shape of a single
  search result and a capped list of up to 10.
- `OpenUrlInputSchema` / `OpenUrlOutputSchema` — validates the URL going
  into `openUrl` and the `{url, content}` coming out.
- `summerizeInputSchema` / `summerizeOutputSchema` — enforces a minimum
  input length (50 chars — not worth summarizing shorter text) and a
  non-empty summary output.
- `SearchInputSchema` — the top-level `{ q }` input, requiring at least 5
  characters so overly vague queries are rejected early.
- `SearchAnswerSchema` — the final, client-facing output shape:
  `{ answer: string (non-empty), sources: string[] (valid URLs, defaults
  to []) }`. Stricter than `Candidate` (drops `mode`, and requires `sources`
  entries to actually be URLs) since this is what leaves the agent, used by
  `finalValidate.ts`.

**Purpose:** validation happens at the boundaries (tool inputs/outputs),
so bad data is caught immediately with a clear error instead of causing
confusing failures deeper in the pipeline.

---

## `agent/src/utils/openUrl.ts`

Fetches a URL and returns cleaned, plain-text page content:
1. `validateUrl` — only allows `http(s)` URLs, throws `"Invalid URL"`
   otherwise (basic SSRF-style protocol guard).
2. Fetches with a custom `User-Agent`.
3. If the response is HTML, strips it down to readable text via
   `html-to-text`, explicitly skipping `nav`/`header`/`footer`/`script`
   elements (the boilerplate that isn't useful to summarize).
4. Collapses whitespace and caps content at 8000 characters (keeps prompt
   size/cost bounded before it reaches the summarizer).
5. Validates the result shape with `OpenUrlOutputSchema`.

---

## `agent/src/utils/summerize.ts`

Given raw page text, asks the chat model for a short, factual summary:
- Validates input length via `summerizeInputSchema`.
- Clips to 4000 characters before sending to the model (cost/context
  control, separate from `openUrl`'s 8000-char cap).
- System prompt enforces: factual, neutral, no marketing language, 5–8
  sentences, no invented sources, beginner-readable.
- Normalizes the model's output (collapses whitespace, hard cap at 2500
  chars) and validates it with `summerizeOutputSchema`.

---

## `agent/src/utils/webSearch.ts`

`webSearchTool(query)` — the actual web search call:
- Switches on `env.SEARCH_PROVIDER` (currently only `"tavily"` implemented;
  anything else throws, making it obvious when a new provider needs wiring
  up here and in `env.ts`).
- Calls the Tavily REST API directly (`fetch`, not an SDK) with
  `max_results: 5` and `search_depth: "basic"` — kept shallow/cheap since
  `webPipeline.ts` does its own deeper per-page fetch + summarize afterward.
- Maps Tavily's `content` field to this project's `snippet` field and
  validates the result list against `WebSearchResultsSchema`.

---

## `agent/src/search_tool/finalValidate.ts`

A last-mile guard that runs after a `Candidate` comes out of either
pipeline, enforcing the stricter `SearchAnswer` shape before anything
leaves the agent:

1. Builds `finalDraft = { answer: candidate.answer, sources: candidate.sources ?? [] }`.
2. Validates it against `SearchAnswerSchema` with `safeParse` (no throw).
   If it already matches, return it as-is.
3. If it doesn't match (e.g. a `sources` entry isn't a valid URL, or
   `answer` came back empty), it asks the chat model to **repair** the
   JSON via `repairSearchAnswer(obj)`: sends the malformed draft to the
   model with instructions to return the same shape as valid JSON only
   (no prose/markdown), then re-validates the repaired result with
   `SearchAnswerSchema.safeParse` before returning it.

This exists as a safety net — the pipelines *should* always produce
well-formed answers, but if a model ever returns something slightly off
(a non-URL "source", stray whitespace, etc.), this gives it one automatic
self-repair attempt instead of failing the whole request.

**Bugs fixed here:**
- The return type on `repairSearchAnswer` was written as
  `Promise<(answer: string, sources: string[])>`, which isn't valid
  TypeScript — the `(...)` after `Promise<` is parsed as the start of a
  function type, so the compiler expected `=>` next and errored with
  `'=>' expected`. Replaced it with the real `SearchAnswer` type imported
  from `schemas.ts`.
- `repairSearchAnswer` had no implementation (just declared `model` and
  never used it or returned anything), despite `finalValidateAndPolish`
  already calling and discarding its result. Implemented it: send the
  malformed object to the model, parse its JSON response, validate with
  `SearchAnswerSchema.parse`.
- The initial call site was `const repaired = repairSearchAnswer(finalDraft)`
  — missing `await` on an `async` function. Since `safeParse` accepts
  `unknown`, this type-checked fine but would validate a `Promise` object
  instead of the resolved `SearchAnswer` at runtime, so the repair path
  could never succeed. Added the missing `await`.

---

## Summary of bugs fixed during this change set

| File | Bug | Fix |
|---|---|---|
| `directPipeline.ts` | `HumanMessage` passed as 2nd arg to `SystemMessage(...)`, silently dropping the user's question | Made it a separate message in the array |
| `webPipeline.ts` (`openAndSummerizeStep`) | `.filter()` callback didn't return its boolean, so every result was dropped; also filtered wrapper objects instead of unwrapping `.value` | Added explicit `return`, filtered on `status`, then `.map(s => s.value)` |
| `webPipeline.ts` (`openAndSummerizeStep`) | Step computed a result but never returned anything | Added `return { ...input, pageSummeries, fallback }` |
| `webPipeline.ts` (`composeStep`) | Same `HumanMessage`-as-2nd-arg bug as `directPipeline.ts` | Same fix — separate message entry |
| `routeStrategy.ts` / `webPipeline.ts` | Minor syntax cleanup (redundant parens, double spaces, inconsistent quote/semicolon style) | Aligned with rest of file |
| `directPipeline.ts` / `webPipeline.ts` (`composeStep`) | Duplicated "ask model with no context" logic in two places | Extracted shared `getDirectAnswer(q)` in `directPipeline.ts`, called from both |
| `finalValidate.ts` (`repairSearchAnswer`) | Invalid return type syntax `Promise<(answer: string, sources: string[])>` | Replaced with real `SearchAnswer` type |
| `finalValidate.ts` (`repairSearchAnswer`) | Function body was empty despite being called for its result | Implemented: ask model to repair the JSON, validate with `SearchAnswerSchema.parse` |
| `finalValidate.ts` (`finalValidateAndPolish`) | Missing `await` on `repairSearchAnswer(...)`, so the repair result was never actually validated | Added `await` |
