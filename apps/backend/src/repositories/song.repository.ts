import type { Song, SongFacets } from "@medleys/shared";

/** Optional filters for `list()`. All combine with AND; absent means unfiltered. */
export interface SongFilters {
  q?: string;
  artist?: string;
  language?: string;
}

/**
 * Persistence boundary for songs. Services depend on this interface only, so
 * the storage engine (libSQL/Turso now, Postgres later) can be swapped by injecting
 * a different implementation in the composition root.
 */
export interface SongRepository {
  create(song: Song): Promise<Song>;
  findById(id: string): Promise<Song | null>;
  /** Find a song by title + artist, compared case-insensitively and trimmed. */
  findByTitleAndArtist(title: string, artist: string): Promise<Song | null>;
  findAll(): Promise<Song[]>;
  list(
    page: number,
    pageSize: number,
    filters?: SongFilters,
  ): Promise<{ items: Song[]; total: number }>;
  searchByTitle(query: string): Promise<Song[]>;
  /** Distinct artist/language values across all songs, sorted ascending. */
  facets(): Promise<SongFacets>;
  update(id: string, patch: Partial<Omit<Song, "id" | "createdAt">>): Promise<Song | null>;
  delete(id: string): Promise<boolean>;
}
