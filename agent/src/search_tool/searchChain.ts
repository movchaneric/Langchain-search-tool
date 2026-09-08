// Router strategy -> Query

import { RunnableBranch, RunnableSequence } from "@langchain/core/runnables";
import { wepBasePath } from "./webPipeline";
import { directBasePath } from "./directPipeline";
import { routerStep } from "./routeStrategy";
import { finalValidateAndPolish } from "./finalValidate";
import { SearchInput } from "../utils/schemas";

// {q, mode -> web or direct

// web => web search path

// direct path

//final validation

// JSON

const branch = RunnableBranch.from<{ q: string; mode: "web" | "direct" }, any>([
  [(input) => input.mode === "web", wepBasePath],
  directBasePath,
]);

export const searchChain = RunnableSequence.from([
  routerStep,
  branch,
  finalValidateAndPolish,
]);

export async function runSearch(input: SearchInput) {
  return await searchChain.invoke(input);
}
