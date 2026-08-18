import type { Song } from "@medleys/shared";

/**
 * Persistence boundary for songs. Services depend on this interface only, so
 * the storage engine (SQLite now, Postgres later) can be swapped by injecting
 * a different implementation in the composition root.
 */
export interface SongRepository {
  create(song: Song): Promise<Song>;
  findById(id: string): Promise<Song | null>;
  /** Find a song by title + artist, compared case-insensitively and trimmed. */
  findByTitleAndArtist(title: string, artist: string): Promise<Song | null>;
  findAll(): Promise<Song[]>;
  list(page: number, pageSize: number): Promise<{ items: Song[]; total: number }>;
  searchByTitle(query: string): Promise<Song[]>;
  update(id: string, patch: Partial<Omit<Song, "id" | "createdAt">>): Promise<Song | null>;
  delete(id: string): Promise<boolean>;
}
