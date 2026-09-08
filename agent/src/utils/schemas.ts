import { z } from "zod";

// save cost ->

export const WebSearchResultSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  snippet: z.string().optional().default(""),
});

export type WebSearchResult = z.infer<typeof WebSearchResultSchema>;

export const WebSearchResultsSchema = z.array(WebSearchResultSchema).max(10);

export type WebSearchResults = z.infer<typeof WebSearchResultsSchema>;

export const OpenUrlInputSchema = z.object({
  url: z.url(),
});

export const OpenUrlOutputSchema = z.object({
  url: z.url(),
  content: z.string().min(1),
});

export const summerizeInputSchema = z.object({
  text: z.string().min(50, "Need more text to summerize"),
});
export const summerizeOutputSchema = z.object({
  summary: z.string().min(1),
});

export const SearchInputSchema = z.object({
  q: z.string().min(5, "Please ask specific query"),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;
