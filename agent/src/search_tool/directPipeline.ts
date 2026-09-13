// cheap mode
// Not calling tavily , fetch , do not summerize
// ask the model directl and get answer

import { RunnableLambda } from "@langchain/core/runnables";
import { Candidate, RouterOutput } from "./types";
import { getChatModel } from "../shared/models";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatMessage } from "../utils/schemas";

export async function getDirectAnswer(
  q: string,
  history: ChatMessage[] = [],
): Promise<Candidate> {
  const model = getChatModel({ temperature: 0.2 });

  const historyMessages = history.map((m) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content),
  );

  const res = await model.invoke([
    new SystemMessage(
      [
        "You answer briefly and clearly for beginners",
        "Rules: ",
        " - Be accurate and neutral",
        " - 5 to 8 sentences at max",
        " - If unsure, say so instead of inventing facts",
        " - Use the prior conversation turns for context (e.g. 'it', 'that', follow-up requests like reformatting the last answer)",
      ].join("\n"),
    ),
    ...historyMessages,
    new HumanMessage(q),
  ]);

  const directAnswer = (
    typeof res.content === "string" ? res.content : String(res.content)
  ).trim();

  return {
    answer: directAnswer,
    sources: [],
    mode: "direct",
  };
}

export const directBasePath = RunnableLambda.from(
  async (input: RouterOutput): Promise<Candidate> =>
    getDirectAnswer(input.q, input.history),
);
