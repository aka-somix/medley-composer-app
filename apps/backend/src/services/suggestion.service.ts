import {
  COMPATIBILITY_THRESHOLD,
  evaluateMatch,
  type Song,
  type Suggestion,
} from "@medleys/shared";
import type { SongRepository } from "../repositories/song.repository.js";
import { NotFoundError } from "../http/errors.js";

/** Maximum number of suggestions returned, ranked best-first. */
const SUGGESTION_LIMIT = 5;

/** Scores are compared as ties when within this float-noise tolerance. */
const SCORE_EPSILON = 1e-9;

/**
 * Finds songs compatible with a target song for medley chaining.
 *
 * Compatibility is decided by ACTIVE_MATCH_RULES (see @medleys/shared): a
 * candidate's score is the best similarity across the active section-comparison
 * rules, and bestMatch records which section pair won. Survivors (score >=
 * COMPATIBILITY_THRESHOLD) are ranked by, in order:
 *   1. highest compatibility score (highest priority)
 *   2. closest BPM
 *   3. same music scale
 *   4. same language (lowest priority)
 * Only the top SUGGESTION_LIMIT survivors are returned.
 */
export class SuggestionService {
  constructor(private readonly repo: SongRepository) {}

  async getSuggestions(songId: string): Promise<Suggestion[]> {
    const target = await this.repo.findById(songId);
    if (!target) throw new NotFoundError("Song", songId);

    const all = await this.repo.findAll();
    const compatible = all
      .filter((song) => song.id !== target.id)
      .map((song) => this.score(target, song))
      .filter((s) => s.score >= COMPATIBILITY_THRESHOLD);

    compatible.sort((a, b) => this.compare(target, a, b));
    return compatible.slice(0, SUGGESTION_LIMIT);
  }

  private score(target: Song, candidate: Song): Suggestion {
    const { best, matches } = evaluateMatch(target, candidate);
    return { song: candidate, score: best.similarity, bestMatch: best, matches };
  }

  private compare(target: Song, a: Suggestion, b: Suggestion): number {
    const scoreDiff = b.score - a.score; // higher score ranks first
    if (Math.abs(scoreDiff) > SCORE_EPSILON) return scoreDiff;

    const bpmDiff = Math.abs(a.song.bpm - target.bpm) - Math.abs(b.song.bpm - target.bpm);
    if (bpmDiff !== 0) return bpmDiff;

    const scaleRank = sameRank(a.song.scale, target.scale) - sameRank(b.song.scale, target.scale);
    if (scaleRank !== 0) return scaleRank;

    return sameRank(a.song.language, target.language) - sameRank(b.song.language, target.language);
  }
}

/** 0 when equal (sorts first), 1 otherwise. */
function sameRank(value: string, target: string): number {
  return value === target ? 0 : 1;
}
