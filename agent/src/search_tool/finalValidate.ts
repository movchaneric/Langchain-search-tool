import { RunnableLambda } from "@langchain/core/runnables";
import { Candidate } from "./types";
import { SearchAnswerSchema, type SearchAnswer } from "../utils/schemas";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const finalValidateAndPolish = RunnableLambda.from(
  async (candidate: Candidate) => {
    const finalDraft = {
      answer: candidate.answer,
      sources: candidate.sources ?? [],
    };

    const parsed1 = SearchAnswerSchema.safeParse(finalDraft);

    if (parsed1.success) return parsed1.data;

    // format is wrong -> fix the format (extra check)
    const repaired = await repairSearchAnswer(finalDraft);
    const parsed2 = SearchAnswerSchema.safeParse(repaired);

    if (parsed2.success) return parsed2.data;
  },
);

async function repairSearchAnswer(obj: unknown): Promise<SearchAnswer> {
  const model = getChatModel({ temperature: 0.2 });

  const res = await model.invoke([
    new SystemMessage(
      [
        'Fix the given JSON so it matches this shape exactly: { "answer": string, "sources": string[] }',
        "Rules:",
        " - Return ONLY valid JSON, no prose, no markdown fences",
        " - Preserve the original answer content and sources, just fix the structure",
      ].join("\n"),
    ),
    new HumanMessage(JSON.stringify(obj)),
  ]);

  const raw =
    typeof res.content === "string" ? res.content : String(res.content);

  return SearchAnswerSchema.parse(JSON.parse(raw));
}
