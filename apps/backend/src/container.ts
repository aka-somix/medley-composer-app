import { randomUUID } from "node:crypto";
import { createDatabase, type DatabaseHandle } from "./db/client.js";
import { DrizzleSongRepository } from "./repositories/drizzle-song.repository.js";
import type { SongRepository } from "./repositories/song.repository.js";
import { SongService } from "./services/song.service.js";
import { SuggestionService } from "./services/suggestion.service.js";
import { SongsController } from "./controllers/songs.controller.js";

export interface ContainerConfig {
  /** SQLite location; ":memory:" for tests, a file path for local dev. */
  dbLocation?: string;
  /** Override the id generator (deterministic ids in tests). */
  generateId?: () => string;
  /** Override the clock (deterministic timestamps in tests). */
  now?: () => string;
  /** Inject a pre-built repository (e.g. a fake) instead of the Drizzle one. */
  repository?: SongRepository;
}

/**
 * Composition root. Wires concrete implementations behind their interfaces.
 * Swapping SQLite for Postgres means providing a different repository here —
 * nothing above this layer changes.
 */
export interface Container {
  controller: SongsController;
  songService: SongService;
  suggestionService: SuggestionService;
  repository: SongRepository;
  database?: DatabaseHandle;
  close: () => void;
}

export function createContainer(config: ContainerConfig = {}): Container {
  let database: DatabaseHandle | undefined;
  let repository = config.repository;

  if (!repository) {
    database = createDatabase(config.dbLocation ?? ":memory:");
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
