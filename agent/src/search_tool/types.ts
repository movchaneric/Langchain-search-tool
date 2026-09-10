// 2 possible paths:
// 1. web path => browse -> summerize -> site urls
// 2. direct path -> Do not have to browse -> LLM knows the answer
// return shared shape

import { SearchInput } from "../utils/schemas";

export type SearchMode = "web" | "direct";

// output of routerStep: the original query plus the chosen strategy
export type RouterOutput = SearchInput & { mode: SearchMode };

export type Candidate = {
  answer: string;
  sources: string[]; // List of urls, and in 2 path return []
  mode: SearchMode;
};
