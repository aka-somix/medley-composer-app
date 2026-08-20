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

/** A named section of a song, used by the matching rules. */
export type SongSection = "verse" | "chorus" | "bridge" | "alternateVerse";

/** One matching rule: compare the source song's `source` section against the candidate's `target` section. */
export interface ComparisonRule {
  source: SongSection;
  target: SongSection;
}

/** The result of one comparison rule for a candidate. */
export interface SectionMatch {
  source: SongSection;
  target: SongSection;
  /** Normalized similarity in [0,1]. */
  similarity: number;
}

/** Compatibility threshold: two progressions are "close" at or above this. */
export const COMPATIBILITY_THRESHOLD = 0.55;

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
  alternateVerseDegrees: DegreeProgression | null;
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
  alternateVerseChords?: string | null;
}

/** A single suggested next song plus which section pair qualified it. */
export interface Suggestion {
  song: Song;
  /** = bestMatch.similarity; COMPATIBILITY_THRESHOLD is applied to this. */
  score: number;
  /** The winning comparison rule — drives the UI "matching part" chip. */
  bestMatch: SectionMatch;
  /** Every evaluated rule, in rule order (detail / future use). */
  matches: SectionMatch[];
}

/** Generic paginated envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** One row that could not be imported during a batch import. */
export interface BatchImportError {
  /** 1-based position of the offending row in the uploaded array. */
  row: number;
  message: string;
}

/**
 * Result of a best-effort batch import: every valid row is created, and each
 * invalid row is skipped and reported. `created` and `errors` together account
 * for the whole uploaded array.
 */
export interface BatchImportResult {
  created: Song[];
  errors: BatchImportError[];
}
