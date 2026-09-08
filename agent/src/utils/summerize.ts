import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from "../shared/models";
import { summerizeInputSchema, summerizeOutputSchema } from "./schemas";

export async function summerize(text: string) {
  const { text: raw } = summerizeInputSchema.parse(text);

  const clipped = clip(raw, 4000);

  const model = getChatModel({ temperature: 0.2 });

  //   Ask the model to summerize in a control manner
  const res = await model.invoke([
    new SystemMessage(
      [
        "You are a helpfull assistant that writes short and accurate summeries",
        "Guidlines: ",
        " - Be factual and neutral and avoid marketing language",
        " -  5 - 8 sentences; no lists unless absolutaly necessary",
        " - Do not invent sources; You only summerize the provided text",
        " - Keep it readable for begginers.",
      ].join("\n"), // Convert array to a string
    ),
    new HumanMessage(
      [
        "Summerize the following content for a beginner friendly audiance",
        "Focus key facts and remove fluff",
        `TEXT: ${clipped}`,
      ].join("\n\n"),
    ),
  ]);

  const rawModelOutput =
    typeof res.content === "string" ? res.content : String(res.content);

  const summray = normalizeSummary(rawModelOutput);

  return summerizeOutputSchema.parse(summray);
}

function clip(text: string, maxNumber: number) {
  return text.length > maxNumber ? text.slice(0, maxNumber) : text;
}

function normalizeSummary(t: string) {
  return t
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 2500);
}
