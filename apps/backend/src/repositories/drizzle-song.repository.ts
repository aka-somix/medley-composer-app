import type { Song } from "@medleys/shared";
import { eq, like, sql, desc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { songs, type SongRow } from "../db/schema.js";
import type { SongRepository } from "./song.repository.js";

function toSong(row: SongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    bpm: row.bpm,
    scale: row.scale,
    language: row.language,
    verseDegrees: row.verseDegrees,
    chorusDegrees: row.chorusDegrees,
    bridgeDegrees: row.bridgeDegrees ?? null,
    createdAt: row.createdAt,
  };
}

/** Escape LIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export class DrizzleSongRepository implements SongRepository {
  constructor(private readonly db: Db) {}

  async create(song: Song): Promise<Song> {
    this.db.insert(songs).values(song).run();
    return song;
  }

  async findById(id: string): Promise<Song | null> {
    const row = this.db.select().from(songs).where(eq(songs.id, id)).get();
    return row ? toSong(row) : null;
  }

  async findAll(): Promise<Song[]> {
    const rows = this.db.select().from(songs).orderBy(desc(songs.createdAt)).all();
    return rows.map(toSong);
  }

  async list(page: number, pageSize: number): Promise<{ items: Song[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const rows = this.db
      .select()
      .from(songs)
      .orderBy(desc(songs.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all();
    const countRow = this.db.select({ count: sql<number>`count(*)` }).from(songs).get();
    return { items: rows.map(toSong), total: countRow?.count ?? 0 };
  }

  async searchByTitle(query: string): Promise<Song[]> {
    const pattern = `%${escapeLike(query)}%`;
    const rows = this.db
      .select()
      .from(songs)
      .where(like(songs.title, pattern))
      .orderBy(desc(songs.createdAt))
      .all();
    return rows.map(toSong);
  }

  async update(id: string, patch: Partial<Omit<Song, "id" | "createdAt">>): Promise<Song | null> {
    const existing = this.db.select().from(songs).where(eq(songs.id, id)).get();
    if (!existing) return null;
    this.db.update(songs).set(patch).where(eq(songs.id, id)).run();
    const updated = this.db.select().from(songs).where(eq(songs.id, id)).get();
    return updated ? toSong(updated) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.delete(songs).where(eq(songs.id, id)).run();
    return result.changes > 0;
  }
}
