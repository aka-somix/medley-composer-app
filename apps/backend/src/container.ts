import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { createDatabase, type DatabaseHandle } from "./db/client.js";
import { DrizzleSongRepository } from "./repositories/drizzle-song.repository.js";
import type { SongRepository } from "./repositories/song.repository.js";
import { DrizzleInviteRepository } from "./repositories/drizzle-invite.repository.js";
import type { InviteRepository } from "./repositories/invite.repository.js";
import { GoogleTokenVerifier, requireInvited, type TokenVerifier } from "./http/require-invited.js";
import { SongService } from "./services/song.service.js";
import { SuggestionService } from "./services/suggestion.service.js";
import { SongsController } from "./controllers/songs.controller.js";

export interface ContainerConfig {
  /**
   * libSQL location; ":memory:" for tests, `file:local.db` for local dev, or a
   * `libsql://…` Turso url for remote.
   */
  dbLocation?: string;
  /** Turso auth token; required for a remote `libsql://…` url. */
  authToken?: string;
  /** Override the id generator (deterministic ids in tests). */
  generateId?: () => string;
  /** Override the clock (deterministic timestamps in tests). */
  now?: () => string;
  /** Inject a pre-built repository (e.g. a fake) instead of the Drizzle one. */
  repository?: SongRepository;
  /** Google OAuth client id used to verify ID tokens. Required unless `verifier` is injected. */
  googleClientId?: string;
  /** Inject a token verifier (a fake) instead of the Google one. */
  verifier?: TokenVerifier;
  /** Inject a pre-built invite repository (e.g. a fake) instead of the Drizzle one. */
  invites?: InviteRepository;
}

/**
 * Composition root. Wires concrete implementations behind their interfaces.
 * Swapping libSQL/Turso for Postgres means providing a different repository
 * here — nothing above this layer changes.
 */
export interface Container {
  controller: SongsController;
  songService: SongService;
  suggestionService: SuggestionService;
  repository: SongRepository;
  invites: InviteRepository;
  requireInvited: RequestHandler;
  database?: DatabaseHandle;
  close: () => void;
}

export async function createContainer(config: ContainerConfig = {}): Promise<Container> {
  let database: DatabaseHandle | undefined;
  let repository = config.repository;
  let invites = config.invites;

  if (!repository || !invites) {
    database = await createDatabase(config.dbLocation ?? ":memory:", config.authToken);
    repository ??= new DrizzleSongRepository(database.db);
    invites ??= new DrizzleInviteRepository(database.db);
  }

  // Built lazily on first use so containers that never hit an auth route
  // (e.g. service-level tests) don't need a GOOGLE_CLIENT_ID.
  let googleVerifier: GoogleTokenVerifier | undefined;
  const verifier: TokenVerifier = config.verifier ?? {
    verify: (idToken) => {
      if (!googleVerifier) {
        if (!config.googleClientId) {
          throw new Error("GOOGLE_CLIENT_ID is required to verify tokens (or inject a verifier)");
        }
        googleVerifier = new GoogleTokenVerifier(config.googleClientId);
      }
      return googleVerifier.verify(idToken);
    },
  };

  const requireInvitedMw = requireInvited({ verifier, invites });

  const songService = new SongService(repository, {
    generateId: config.generateId ?? (() => randomUUID()),
    now: config.now ?? (() => new Date().toISOString()),
  });
  const suggestionService = new SuggestionService(repository);
  const controller = new SongsController(songService, suggestionService);

  return {
    controller,
    songService,
    suggestionService,
    repository,
    invites,
    requireInvited: requireInvitedMw,
    database,
    close: () => database?.close(),
  };
}
