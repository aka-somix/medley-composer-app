import express, { type Express } from "express";
import cors from "cors";
import type { Container } from "./container.js";
import { createSongsRouter } from "./routes/songs.routes.js";
import { errorMiddleware } from "./http/errors.js";

/** Build the Express app from a container. Kept separate from server boot so tests can drive it in-process. */
export function createApp(container: Container): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/songs", createSongsRouter(container.controller, container.requireInvited));

  app.get("/api/auth/me", container.requireInvited, (req, res) => {
    res.json({ email: req.user!.email });
  });

  app.use(errorMiddleware);
  return app;
}
