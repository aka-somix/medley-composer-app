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
    alternateVerseDegrees: row.alternateVerseDegrees ?? null,
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
    await this.db.insert(songs).values(song).run();
    return song;
  }

  async findById(id: string): Promise<Song | null> {
    const row = await this.db.select().from(songs).where(eq(songs.id, id)).get();
    return row ? toSong(row) : null;
  }

  async findByTitleAndArtist(title: string, artist: string): Promise<Song | null> {
    const row = await this.db
      .select()
      .from(songs)
      .where(
        sql`lower(trim(${songs.title})) = ${title.trim().toLowerCase()}
          and lower(trim(${songs.artist})) = ${artist.trim().toLowerCase()}`,
      )
      .get();
    return row ? toSong(row) : null;
  }

  async findAll(): Promise<Song[]> {
    const rows = await this.db.select().from(songs).orderBy(desc(songs.createdAt)).all();
    return rows.map(toSong);
  }

  async list(page: number, pageSize: number): Promise<{ items: Song[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select()
      .from(songs)
      .orderBy(desc(songs.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all();
    const countRow = await this.db.select({ count: sql<number>`count(*)` }).from(songs).get();
    return { items: rows.map(toSong), total: countRow?.count ?? 0 };
  }

  async searchByTitle(query: string): Promise<Song[]> {
    const pattern = `%${escapeLike(query)}%`;
    const rows = await this.db
      .select()
      .from(songs)
      .where(like(songs.title, pattern))
      .orderBy(desc(songs.createdAt))
      .all();
    return rows.map(toSong);
  }

  async update(id: string, patch: Partial<Omit<Song, "id" | "createdAt">>): Promise<Song | null> {
    const existing = await this.db.select().from(songs).where(eq(songs.id, id)).get();
    if (!existing) return null;
    await this.db.update(songs).set(patch).where(eq(songs.id, id)).run();
    const updated = await this.db.select().from(songs).where(eq(songs.id, id)).get();
    return updated ? toSong(updated) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(songs).where(eq(songs.id, id)).run();
    return result.rowsAffected > 0;
  }
}
