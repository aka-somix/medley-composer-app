import { describe, it, expect } from "vitest";
import type { Song } from "../types.js";
import {
  ACTIVE_MATCH_RULES,
  MATCH_RULES_V1,
  evaluateMatch,
  sectionDegrees,
} from "./matching.js";

function song(over: Partial<Song>): Song {
  return {
    id: "x",
    title: "t",
    artist: "a",
    bpm: 120,
    scale: "C",
    language: "English",
    verseDegrees: [],
    chorusDegrees: [],
    bridgeDegrees: null,
    alternateVerseDegrees: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("MATCH_RULES_V1 / ACTIVE_MATCH_RULES", () => {
  it("is the V1 rule set: verse -> verse | chorus | alternateVerse", () => {
    expect(ACTIVE_MATCH_RULES).toBe(MATCH_RULES_V1);
    expect(MATCH_RULES_V1).toEqual([
      { source: "verse", target: "verse" },
      { source: "verse", target: "chorus" },
      { source: "verse", target: "alternateVerse" },
    ]);
  });
});

describe("sectionDegrees", () => {
  it("reads the right section; null bridge/alternateVerse become []", () => {
    const s = song({
      verseDegrees: ["1", "5"],
      chorusDegrees: ["4", "1"],
      bridgeDegrees: null,
      alternateVerseDegrees: null,
    });
    expect(sectionDegrees(s, "verse")).toEqual(["1", "5"]);
    expect(sectionDegrees(s, "chorus")).toEqual(["4", "1"]);
    expect(sectionDegrees(s, "bridge")).toEqual([]);
    expect(sectionDegrees(s, "alternateVerse")).toEqual([]);
  });
});

describe("evaluateMatch", () => {
  it("returns one result per active rule, in rule order", () => {
    const source = song({ verseDegrees: ["1", "5", "6m", "4"] });
    const candidate = song({ verseDegrees: ["1", "5", "6m", "4"] });
    const { matches } = evaluateMatch(source, candidate);
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => `${m.source}->${m.target}`)).toEqual([
      "verse->verse",
      "verse->chorus",
      "verse->alternateVerse",
    ]);
  });

  it("best is verse->verse when the source verse equals the candidate verse", () => {
    const source = song({ verseDegrees: ["1", "5", "6m", "4"] });
    const candidate = song({ verseDegrees: ["1", "5", "6m", "4"] });
    const { best } = evaluateMatch(source, candidate);
    expect(best).toEqual({ source: "verse", target: "verse", similarity: 1 });
  });

  it("matches cross-section: source verse vs candidate chorus", () => {
    const source = song({ verseDegrees: ["1", "5", "6m", "4"] });
    const candidate = song({
      verseDegrees: ["1M7", "2m7"],
      chorusDegrees: ["1", "5", "6m", "4"],
    });
    const { best } = evaluateMatch(source, candidate);
    expect(best).toEqual({ source: "verse", target: "chorus", similarity: 1 });
  });

  it("matches source verse vs candidate alternateVerse", () => {
    const source = song({ verseDegrees: ["1", "5", "6m", "4"] });
    const candidate = song({
      verseDegrees: ["1M7"],
      chorusDegrees: ["2m7"],
      alternateVerseDegrees: ["1", "5", "6m", "4"],
    });
    const { best } = evaluateMatch(source, candidate);
    expect(best).toEqual({ source: "verse", target: "alternateVerse", similarity: 1 });
  });

  it("a null target section scores 0 for that rule", () => {
    const source = song({ verseDegrees: ["1", "5", "6m", "4"] });
    const candidate = song({
      verseDegrees: ["2m", "3m"],
      chorusDegrees: ["2m", "3m"],
      alternateVerseDegrees: null,
    });
    const { matches } = evaluateMatch(source, candidate);
    const alt = matches.find((m) => m.target === "alternateVerse")!;
    expect(alt.similarity).toBe(0);
  });

  it("breaks ties by rule order (first rule wins)", () => {
    const source = song({ verseDegrees: ["1", "5"] });
    const candidate = song({ verseDegrees: ["1", "5"], chorusDegrees: ["1", "5"] });
    const { best } = evaluateMatch(source, candidate);
    expect(best.target).toBe("verse");
    expect(best.similarity).toBe(1);
  });
});
