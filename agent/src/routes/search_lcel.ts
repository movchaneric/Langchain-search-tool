import { Router, type Request, type Response } from "express";
import { SearchInputSchema } from "../utils/schemas";
import { runSearch } from "../search_tool/searchChain";

export const searchRouter = Router();

searchRouter.post("/", async (req: Request, res: Response) => {
  try {
    const input = SearchInputSchema.parse(req.body);
    const result = await runSearch(input);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error)?.message ?? "unknown" });
  }
});
