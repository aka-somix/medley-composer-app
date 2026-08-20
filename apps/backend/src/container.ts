import { randomUUID } from "node:crypto";
import { createDatabase, type DatabaseHandle } from "./db/client.js";
import { DrizzleSongRepository } from "./repositories/drizzle-song.repository.js";
import type { SongRepository } from "./repositories/song.repository.js";
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
  database?: DatabaseHandle;
  close: () => void;
}

export async function createContainer(config: ContainerConfig = {}): Promise<Container> {
  let database: DatabaseHandle | undefined;
  let repository = config.repository;

  if (!repository) {
    database = await createDatabase(config.dbLocation ?? ":memory:", config.authToken);
    repository = new DrizzleSongRepository(database.db);
  }

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
    database,
    close: () => database?.close(),
  };
}
