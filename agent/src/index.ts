import "dotenv/config";

import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./shared/env";
import swaggerSpec from "./shared/swagger";
import { searchRouter } from "./routes/search_lcel";
import { lightRagRouter } from "./routes/light_rag_router";

const app = express();

app.use(cors({ origin: env.ALLOWED_ORIGIN }));
app.use(express.json());

app.use("/api/search", searchRouter);
app.use("/api/kb", lightRagRouter);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (_req, res) => {
  res.status(200).json(swaggerSpec);
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is up
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
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
