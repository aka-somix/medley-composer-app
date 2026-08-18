/**
 * Rule-based section matching between two songs.
 *
 * Matching is driven by a versioned list of (sourceSection -> targetSection)
 * rules. A candidate's score is the best similarity across the active rules,
 * and the winning rule identifies which section pair matched. Extend matching
 * by editing ACTIVE_MATCH_RULES (or adding a new versioned array below).
 */
import type {
  ComparisonRule,
  DegreeProgression,
  SectionMatch,
  Song,
  SongSection,
} from "../types.js";
import { progressionSimilarity } from "./similarity.js";

/** V1 rules: compare the source song's verse against three candidate sections. */
export const MATCH_RULES_V1: readonly ComparisonRule[] = [
  { source: "verse", target: "verse" },
  { source: "verse", target: "chorus" },
  { source: "verse", target: "alternateVerse" },
];

/** The active rule set. Swap this to change matching for the whole system. */
export const ACTIVE_MATCH_RULES: readonly ComparisonRule[] = MATCH_RULES_V1;

/** Read a song's degree progression for a section; null sections become []. */
export function sectionDegrees(song: Song, section: SongSection): DegreeProgression {
  switch (section) {
    case "verse":
      return song.verseDegrees;
    case "chorus":
      return song.chorusDegrees;
    case "bridge":
      return song.bridgeDegrees ?? [];
    case "alternateVerse":
      return song.alternateVerseDegrees ?? [];
  }
}

/**
 * Evaluate all rules between a source and candidate song. Returns every rule's
 * result (in rule order) and the best one. On a tie the earliest rule wins.
 */
export function evaluateMatch(
  source: Song,
  candidate: Song,
  rules: readonly ComparisonRule[] = ACTIVE_MATCH_RULES,
): { best: SectionMatch; matches: SectionMatch[] } {
  const matches: SectionMatch[] = rules.map((rule) => ({
    source: rule.source,
    target: rule.target,
    similarity: progressionSimilarity(
      sectionDegrees(source, rule.source),
      sectionDegrees(candidate, rule.target),
    ),
  }));

  let best = matches[0]!;
  for (const match of matches) {
    if (match.similarity > best.similarity) best = match;
  }
  return { best, matches };
}
