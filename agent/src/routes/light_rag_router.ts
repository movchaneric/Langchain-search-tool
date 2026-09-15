import { Router, type Request, type Response } from "express";
import { AskKBRequestSchema, IngestTextRequestSchema } from "../utils/schemas";
import { ingestText } from "../light_rag_kb/ingest";
import { askKB } from "../light_rag_kb/ask";
import { resetStore, listChunks } from "../light_rag_kb/store";

export const lightRagRouter = Router();

lightRagRouter.get("/chunks", (_req: Request, res: Response) => {
  res.status(200).json({ chunks: listChunks() });
});

lightRagRouter.post("/ingest", async (req: Request, res: Response) => {
  try {
    const input = IngestTextRequestSchema.parse(req.body);
    const result = await ingestText(input);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error)?.message ?? "unknown" });
  }
});

lightRagRouter.post("/ask", async (req: Request, res: Response) => {
  try {
    const { query, k } = AskKBRequestSchema.parse(req.body);
    const result = await askKB(query, k);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error)?.message ?? "unknown" });
  }
});

lightRagRouter.post("/reset", (_req: Request, res: Response) => {
  resetStore();
  res.status(200).json({ ok: true });
});
