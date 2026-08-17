import { Router } from "express";
import type { SongsController } from "../controllers/songs.controller.js";
import { asyncHandler } from "../http/errors.js";

/** Build the /songs router. Order matters: /search before /:id. */
export function createSongsRouter(controller: SongsController): Router {
  const router = Router();

  router.get("/search", asyncHandler(controller.search));
  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));
  router.get("/:id/suggestions", asyncHandler(controller.suggestions));
  router.get("/:id", asyncHandler(controller.get));
  router.put("/:id", asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.remove));

  return router;
}
