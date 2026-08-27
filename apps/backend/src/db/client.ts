import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export type Db = LibSQLDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Db;
  raw: Client;
  close: () => void;
}

/**
 * Create a libSQL-backed Drizzle database. `location` is a libSQL url:
 * `":memory:"` for an ephemeral database (tests), `file:local.db` for a local
 * file, or a `libsql://…` Turso url (pass `authToken` for remote). The schema
 * is created idempotently on open so no separate migration step is needed for
 * local/dev use.
 */
export async function createDatabase(
  location = ":memory:",
  authToken?: string,
): Promise<DatabaseHandle> {
  const raw = createClient({ url: location, authToken });
  await ensureSchema(raw);
  const db = drizzle(raw, { schema });
  return { db, raw, close: () => raw.close() };
}

async function ensureSchema(raw: Client): Promise<void> {
  await raw.executeMultiple(`
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
      alternate_verse_degrees TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs (title);
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs (artist);
    CREATE INDEX IF NOT EXISTS idx_songs_language ON songs (language);
    CREATE TABLE IF NOT EXISTS invited_emails (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);
  // Add the column to pre-existing databases created before this field existed.
  try {
    await raw.execute("ALTER TABLE songs ADD COLUMN alternate_verse_degrees TEXT");
  } catch {
    /* column already exists */
  }
}
