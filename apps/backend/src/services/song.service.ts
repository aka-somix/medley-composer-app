import {
  chordsToDegrees,
  parseProgression,
  type Paginated,
  type Song,
} from "@medleys/shared";
import type { SongRepository } from "../repositories/song.repository.js";
import type { CreateSongBody, UpdateSongBody } from "../validation.js";
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
      createdAt: this.deps.now(),
    };
    return this.repo.create(song);
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

    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError("Song", id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const removed = await this.repo.delete(id);
    if (!removed) throw new NotFoundError("Song", id);
  }
}
