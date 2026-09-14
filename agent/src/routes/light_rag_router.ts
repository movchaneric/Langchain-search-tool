import { Router, type Request, type Response } from "express";
import { AskKBRequestSchema, IngestTextRequestSchema } from "../utils/schemas";
import { ingestText } from "../light_rag_kb/ingest";
import { askKB } from "../light_rag_kb/ask";
import { resetStore } from "../light_rag_kb/store";

export const lightRagRouter = Router();

/**
 * @openapi
 * /api/kb/ingest:
 *   post:
 *     summary: Chunk + embed text and add it to the in-memory knowledge base
 *     tags: [Knowledge Base]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IngestTextRequest'
 *     responses:
 *       200:
 *         description: Ingestion summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IngestResult'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
lightRagRouter.post("/ingest", async (req: Request, res: Response) => {
  try {
    const input = IngestTextRequestSchema.parse(req.body);
    const result = await ingestText(input);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error)?.message ?? "unknown" });
  }
});

/**
 * @openapi
 * /api/kb/ask:
 *   post:
 *     summary: Retrieve relevant chunks and answer the question grounded on them
 *     tags: [Knowledge Base]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AskKBRequest'
 *     responses:
 *       200:
 *         description: Grounded answer with per-chunk sources and a confidence score
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KBAskResult'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
lightRagRouter.post("/ask", async (req: Request, res: Response) => {
  try {
    const { query, k } = AskKBRequestSchema.parse(req.body);
    const result = await askKB(query, k);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error)?.message ?? "unknown" });
  }
});

/**
 * @openapi
 * /api/kb/reset:
 *   post:
 *     summary: Drop the in-memory vector store (dev/testing utility)
 *     tags: [Knowledge Base]
 *     responses:
 *       200:
 *         description: Store cleared
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
lightRagRouter.post("/reset", (_req: Request, res: Response) => {
  resetStore();
  res.status(200).json({ ok: true });
});
