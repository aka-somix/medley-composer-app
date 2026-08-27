import { Router, type RequestHandler } from "express";
import type { SongsController } from "../controllers/songs.controller.js";
import { asyncHandler } from "../http/errors.js";

/** Build the /songs router. Order matters: /search before /:id. */
export function createSongsRouter(controller: SongsController, requireInvited: RequestHandler): Router {
  const router = Router();

  router.get("/search", asyncHandler(controller.search));
  router.get("/facets", asyncHandler(controller.facets));
  router.get("/", asyncHandler(controller.list));
  router.post("/batch", requireInvited, asyncHandler(controller.batchImport));
  router.post("/", requireInvited, asyncHandler(controller.create));
  router.get("/:id/suggestions", asyncHandler(controller.suggestions));
  router.get("/:id", asyncHandler(controller.get));
  router.put("/:id", requireInvited, asyncHandler(controller.update));
  router.delete("/:id", requireInvited, asyncHandler(controller.remove));

  return router;
}
