import {
  chordsToDegrees,
  parseProgression,
  type BatchImportResult,
  type Paginated,
  type Song,
} from "@medleys/shared";
import type { SongRepository } from "../repositories/song.repository.js";
import { createSongSchema, type CreateSongBody, type UpdateSongBody } from "../validation.js";
import { NotFoundError } from "../http/errors.js";

/** Injected side-effect providers, so the service stays deterministic in tests. */
export interface SongServiceDeps {
  generateId: () => string;
  now: () => string;
}

function translateSection(raw: string | null | undefined, scale: string): string[] | null {
  if (raw == null) return null;
  const tokens = parseProgression(raw);
  if (tokens.length === 0) return null;
  return chordsToDegrees(tokens, scale);
}

export class SongService {
  constructor(
    private readonly repo: SongRepository,
    private readonly deps: SongServiceDeps,
  ) {}

  /** Create a song, translating its chords (in its own scale) to degree tokens. */
  async create(input: CreateSongBody): Promise<Song> {
    const song: Song = {
      id: this.deps.generateId(),
      title: input.title,
      artist: input.artist,
      bpm: input.bpm,
      scale: input.scale,
      language: input.language,
      verseDegrees: chordsToDegrees(parseProgression(input.verseChords), input.scale),
      chorusDegrees: chordsToDegrees(parseProgression(input.chorusChords), input.scale),
      bridgeDegrees: translateSection(input.bridgeChords, input.scale),
      alternateVerseDegrees: translateSection(input.alternateVerseChords, input.scale),
      createdAt: this.deps.now(),
    };
    return this.repo.create(song);
  }

  /**
   * Best-effort batch import with upsert semantics. Valid rows are persisted;
   * a row whose title+artist matches an existing song (case-insensitive, trimmed)
   * updates that song in place, preserving its id and createdAt, rather than
   * creating a duplicate. Invalid rows (bad shape or bad chords) are skipped and
   * reported by their 1-based position. `created` holds the resulting songs
   * (created or updated), deduplicated by id so an in-batch duplicate collapses
   * to one entry with the last row's values.
   */
  async createMany(rows: unknown[]): Promise<BatchImportResult> {
    const created: Song[] = [];
    const indexById = new Map<string, number>();
    const errors: BatchImportResult["errors"] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = i + 1;
      const parsed = createSongSchema.safeParse(rows[i]);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.join(".");
        errors.push({
          row,
          message: issue ? [path, issue.message].filter(Boolean).join(": ") : "Invalid song",
        });
        continue;
      }
      try {
        const existing = await this.repo.findByTitleAndArtist(
          parsed.data.title,
          parsed.data.artist,
        );
        const song = existing
          ? await this.update(existing.id, parsed.data)
          : await this.create(parsed.data);

        const at = indexById.get(song.id);
        if (at === undefined) {
          indexById.set(song.id, created.length);
          created.push(song);
        } else {
          created[at] = song;
        }
      } catch (err) {
        errors.push({ row, message: err instanceof Error ? err.message : "Failed to import song" });
      }
    }

    return { created, errors };
  }

  async getById(id: string): Promise<Song> {
    const song = await this.repo.findById(id);
    if (!song) throw new NotFoundError("Song", id);
    return song;
  }

  async list(page: number, pageSize: number): Promise<Paginated<Song>> {
    const { items, total } = await this.repo.list(page, pageSize);
    return { items, total, page, pageSize };
  }

  async search(query: string): Promise<Song[]> {
    if (query.length === 0) return [];
    return this.repo.searchByTitle(query);
  }

  /** Update a song; re-translates any chord section that was provided. */
  async update(id: string, input: UpdateSongBody): Promise<Song> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Song", id);

    const scale = input.scale ?? existing.scale;
    const patch: Partial<Omit<Song, "id" | "createdAt">> = {};

    if (input.title !== undefined) patch.title = input.title;
    if (input.artist !== undefined) patch.artist = input.artist;
    if (input.bpm !== undefined) patch.bpm = input.bpm;
    if (input.language !== undefined) patch.language = input.language;
    if (input.scale !== undefined) patch.scale = input.scale;
    if (input.verseChords !== undefined)
      patch.verseDegrees = chordsToDegrees(parseProgression(input.verseChords), scale);
    if (input.chorusChords !== undefined)
      patch.chorusDegrees = chordsToDegrees(parseProgression(input.chorusChords), scale);
    if (input.bridgeChords !== undefined)
      patch.bridgeDegrees = translateSection(input.bridgeChords, scale);
    if (input.alternateVerseChords !== undefined)
      patch.alternateVerseDegrees = translateSection(input.alternateVerseChords, scale);

    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError("Song", id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const removed = await this.repo.delete(id);
    if (!removed) throw new NotFoundError("Song", id);
  }
}
