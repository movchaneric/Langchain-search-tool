// cheap mode
// Not calling tavily , fetch , do not summerize
// ask the model directl and get answer

import { RunnableLambda } from "@langchain/core/runnables";
import { Candidate } from "./types";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export async function getDirectAnswer(q: string): Promise<Candidate> {
  const model = getChatModel({ temperature: 0.2 });

  const res = await model.invoke([
    new SystemMessage(
      [
        "You answer briefly and clearly for beginners",
        "Rules: ",
        " - Be accurate and neutral",
        " - 5 to 8 sentences at max",
        " - If unsure, say so instead of inventing facts",
      ].join("\n"),
    ),
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
  async (input: { q: string; mode: "web" | "direct" }): Promise<Candidate> =>
    getDirectAnswer(input.q),
);
