import type { Song, SongFacets } from "@medleys/shared";
import { and, eq, sql, desc, type SQL } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { songs, type SongRow } from "../db/schema.js";
import type { SongFilters, SongRepository } from "./song.repository.js";

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

/** Compose the `list()` filters into a single WHERE clause, or undefined when none apply. */
function buildWhere(filters?: SongFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters?.q) {
    const pattern = `%${escapeLike(filters.q.toLowerCase())}%`;
    conditions.push(
      sql`(lower(${songs.title}) LIKE ${pattern} ESCAPE '\\' OR lower(${songs.artist}) LIKE ${pattern} ESCAPE '\\')`,
    );
  }
  if (filters?.artist) {
    conditions.push(sql`lower(trim(${songs.artist})) = ${filters.artist.trim().toLowerCase()}`);
  }
  if (filters?.language) {
    conditions.push(
      sql`lower(trim(${songs.language})) = ${filters.language.trim().toLowerCase()}`,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
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

  async list(
    page: number,
    pageSize: number,
    filters?: SongFilters,
  ): Promise<{ items: Song[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const where = buildWhere(filters);
    const rows = await this.db
      .select()
      .from(songs)
      .where(where)
      .orderBy(desc(songs.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all();
    const countRow = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(songs)
      .where(where)
      .get();
    return { items: rows.map(toSong), total: countRow?.count ?? 0 };
  }

  async searchByTitle(query: string): Promise<Song[]> {
    const pattern = `%${escapeLike(query)}%`;
    const rows = await this.db
      .select()
      .from(songs)
      .where(sql`${songs.title} LIKE ${pattern} ESCAPE '\\'`)
      .orderBy(desc(songs.createdAt))
      .all();
    return rows.map(toSong);
  }

  async facets(): Promise<SongFacets> {
    const artistRows = await this.db
      .selectDistinct({ artist: songs.artist })
      .from(songs)
      .orderBy(songs.artist)
      .all();
    const languageRows = await this.db
      .selectDistinct({ language: songs.language })
      .from(songs)
      .orderBy(songs.language)
      .all();
    return {
      artists: artistRows.map((r) => r.artist),
      languages: languageRows.map((r) => r.language),
    };
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
