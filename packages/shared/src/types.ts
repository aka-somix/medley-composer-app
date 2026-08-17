/**
 * Shared domain and API contract types used by both backend and frontend.
 *
 * Progressions are stored canonically as arrays of scale-degree tokens
 * (e.g. ["1", "5", "2m", "4M7"]) so all comparison and transposition is
 * key-independent. See ./music/chords.ts for the translation logic.
 */

/** A single degree token such as "1", "2m", "4M7", "b3", "#4sus4". */
export type DegreeToken = string;

/** A degree progression: an ordered list of degree tokens. */
export type DegreeProgression = DegreeToken[];

/** Compatibility threshold: two progressions are "close" at or above this. */
export const COMPATIBILITY_THRESHOLD = 0.5;

/** A song as persisted and returned by the API. */
export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  /** Original key the song was entered in, e.g. "C", "G", "F#". Major-key root. */
  scale: string;
  /** Free-text language, e.g. "English", "Italian". Used only for ranking. */
  language: string;
  verseDegrees: DegreeProgression;
  chorusDegrees: DegreeProgression;
  bridgeDegrees: DegreeProgression | null;
  createdAt: string;
}

/**
 * Payload for creating a song. Chords are supplied as raw comma-separated
 * symbols in the song's own scale; the backend translates them to degrees.
 */
export interface CreateSongInput {
  title: string;
  artist: string;
  bpm: number;
  scale: string;
  language: string;
  verseChords: string;
  chorusChords: string;
  bridgeChords?: string | null;
}

/** A single suggested next song, with the similarity scores that qualified it. */
export interface Suggestion {
  song: Song;
  verseSimilarity: number;
  chorusSimilarity: number;
  /** max(verseSimilarity, chorusSimilarity) — the value the threshold is applied to. */
  score: number;
}

/** Generic paginated envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
