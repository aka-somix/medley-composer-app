import { describe, it, expect } from "vitest";
import { levenshtein, progressionSimilarity } from "./similarity.js";

describe("levenshtein", () => {
  it("is zero for identical sequences", () => {
    expect(levenshtein(["1", "5", "2m"], ["1", "5", "2m"])).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(levenshtein(["1", "5", "2m"], ["1", "4", "2m"])).toBe(1);
  });

  it("counts insertions and deletions", () => {
    expect(levenshtein(["1", "5"], ["1", "5", "6"])).toBe(1);
    expect(levenshtein([], ["1", "5"])).toBe(2);
  });
});

describe("progressionSimilarity", () => {
  it("is 1 for identical progressions", () => {
    expect(progressionSimilarity(["1", "5", "2m", "4"], ["1", "5", "2m", "4"])).toBe(1);
  });

  it("is 1 for two empty progressions", () => {
    expect(progressionSimilarity([], [])).toBe(1);
  });

  it("is 0 for a fully disjoint, equal-length progression", () => {
    expect(progressionSimilarity(["1", "2", "3"], ["4", "5", "6"])).toBe(0);
  });

  it("scores one edit in four as 0.75", () => {
    expect(progressionSimilarity(["1", "5", "2m", "4"], ["1", "5", "2m", "6"])).toBeCloseTo(0.75);
  });

  it("crosses the 0.7 threshold for 3-of-4 matches but not 2-of-4", () => {
    expect(progressionSimilarity(["1", "5", "6", "4"], ["1", "5", "6", "2"])).toBeGreaterThanOrEqual(0.7);
    expect(progressionSimilarity(["1", "5", "6", "4"], ["1", "5", "3", "2"])).toBeLessThan(0.7);
  });
});
