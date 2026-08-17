import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

export interface DatabaseHandle {
  db: Db;
  raw: Database.Database;
  close: () => void;
}

/**
 * Create a SQLite-backed Drizzle database. Pass ":memory:" for an ephemeral
 * database (used in tests). The schema is created idempotently on open so no
 * separate migration step is needed for local/dev use.
 */
export function createDatabase(location = ":memory:"): DatabaseHandle {
  const raw = new Database(location);
  raw.pragma("journal_mode = WAL");
  ensureSchema(raw);
  const db = drizzle(raw, { schema });
  return { db, raw, close: () => raw.close() };
}

function ensureSchema(raw: Database.Database): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      bpm INTEGER NOT NULL,
      scale TEXT NOT NULL,
      language TEXT NOT NULL,
      verse_degrees TEXT NOT NULL,
      chorus_degrees TEXT NOT NULL,
      bridge_degrees TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs (title);
  `);
}
