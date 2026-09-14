import { Router, type Request, type Response } from "express";
import { SearchInputSchema } from "../utils/schemas";
import { runSearch } from "../search_tool/searchChain";

export const searchRouter = Router();

/**
 * @openapi
 * /api/search:
 *   post:
 *     summary: Run the search pipeline (router picks web or direct mode)
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchInput'
 *     responses:
 *       200:
 *         description: Grounded answer with sources
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchAnswer'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
searchRouter.post("/", async (req: Request, res: Response) => {
  try {
    const input = SearchInputSchema.parse(req.body);
    const result = await runSearch(input);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error)?.message ?? "unknown" });
  }
});
