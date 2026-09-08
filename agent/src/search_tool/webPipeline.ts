// step 1: USer types in the UI: top 10 engineering collges in India 2025 ?

// step 2: search the web
// step 3: visit every result page ->
// in step 3: summarize
// step 4 return the candidate, answer, sources, mode

import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { webSearchTool } from "../utils/webSearch";
import { openUrl } from "../utils/openUrl";
import { summerize } from "../utils/summerize";
import { Candidate } from "./types";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const setTopResults = 5;

// Runnable 1
export const webSearchStep = RunnableLambda.from(
  async (input: { q: string; mode: "web" | "direct" }) => {
    const results = await webSearchTool(input.q);

    return {
      ...input,
      results,
    };
  },
);

// Runnable 2
export const openAndSummerizeStep = RunnableLambda.from(
  async (input: { q: string; mode: "web" | "direct"; results: any[] }) => {
    if (!Array.isArray(input.results) || input.results.length === 0) {
      return {
        ...input,
        pageSummeries: [],
        fallback: "no-results",
      };
    }

    const extractTopResults = input.results.slice(0, setTopResults);

    const settledResults = await Promise.allSettled(
      extractTopResults.map(async (result: any) => {
        const opened = await openUrl(result.url);
        const summerizedOpenedUrl = await summerize(opened.content);

        return { url: opened.url, summary: summerizedOpenedUrl.summary };
      }),
    );

    // status -> fulfilled
    const settledResultsPageSummaries = settledResults
      .filter((settledResult) => settledResult.status === "fulfilled")
      .map((s) => s.value);

    //   Extreme edge case: allSettled every case fails -> all pages failed
    if (settledResultsPageSummaries.length === 0) {
      const fallbackSnippetSummeries = extractTopResults
        .map((result: any) => ({
          url: result.url,
          summary: String(result.snippet || result.title || ""),
        }))
        .filter((x: any) => x.summary.length > 0);

      return {
        ...input,
        pageSummeries: fallbackSnippetSummeries,
        fallback: "snippets" as const,
      };
    }

    return {
      ...input,
      pageSummeries: settledResultsPageSummaries,
      fallback: "none" as const,
    };
  },
);

// Runnable 3
// step 4: Composed step
//  the input is {q, pageSummeris: [{url, summary}], mode, fallback}
//  return the candidate -> answer, sources and mode
export const composeStep = RunnableLambda.from(
  async (input: {
    q: string;
    pageSummeries: Array<{ url: string; summary: string }>;
    mode: "web" | "direct";
    fallback: "no-results" | "snippets" | "none";
  }): Promise<Candidate> => {
    const model = getChatModel({ temperature: 0.2 });

    // No page summerize arrived -> redirect directly to LLM 
    if (!input.pageSummeries || input.pageSummeries.length === 0) {
      const directResponseFromModel = await model.invoke([
        new SystemMessage(
          [
            "you answer briefly and clearly for beginners",
            "if unsure say no",
          ].join("\n"),
        ),
        new HumanMessage(input.q),
      ]);

      const directAnswer = (
        typeof directResponseFromModel.content === "string"
          ? directResponseFromModel.content
          : String(directResponseFromModel.content)
      ).trim();

      return {
        answer: directAnswer,
        sources: [],
        mode: "direct",
      };
    }

    // Have page summeries
    const res = await model.invoke([
      new SystemMessage(
        [
          "You concisley answer questions using provided page summeries",
          "Rules: ",
          " - Be accurate and neutral",
          " - 5 to 8 sentences at max",
          " - Use only the provided summeries, DO NOT invent new facts",
        ].join("\n"),
      ),
      new HumanMessage(
        [
          `Questions: ${input.q}`,
          "Summeries: ",
          JSON.stringify(input.pageSummeries, null, 2),
        ].join("\n"),
      ),
    ]);

    const finalAnswer =
      typeof res.content === "string" ? res.content : String(res.content);

    const extractSources = input.pageSummeries.map((x) => x.url);

    return {
      answer: finalAnswer,
      sources: extractSources,
      mode: "web",
    };
  },
);

// LCEL steps:
// webSearchStep -> openAndSummerizeStep -> composeStep
export const wepBasePath = RunnableSequence.from([
  webSearchStep,
  openAndSummerizeStep,
  composeStep,
]);
