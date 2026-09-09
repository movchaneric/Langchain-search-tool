import "dotenv/config";

import express from "express";
import cors from "cors";
import { env } from "./shared/env";
import { searchRouter } from "./routes/search_lcel";

const app = express();

app.use(cors({ origin: env.ALLOWED_ORIGIN }));
app.use(express.json());

app.use("/api/search", searchRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
