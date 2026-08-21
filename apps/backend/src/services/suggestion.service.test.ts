import { beforeEach, describe, it, expect } from "vitest";
import { createContainer, type Container } from "../container.js";
import type { CreateSongBody } from "../validation.js";
import { COMPATIBILITY_THRESHOLD } from "@medleys/shared";

let seq = 0;
function makeContainer(): Promise<Container> {
  seq = 0;
  return createContainer({
    generateId: () => `id-${++seq}`,
    now: () => "2026-08-17T00:00:00.000Z",
    verifier: { verify: async () => ({ email: "test@example.com", email_verified: true }) },
    invites: { isInvited: async () => true },
  });
}

const base: Omit<CreateSongBody, "title"> = {
  artist: "A",
  bpm: 120,
  scale: "C",
  language: "English",
  verseChords: "C, G, Am, F",
  chorusChords: "F, C, G, Am",
  bridgeChords: null,
};

describe("SuggestionService", () => {
  let container: Container;
  beforeEach(async () => {
    container = await makeContainer();
  });

  it("returns only songs scoring at or above the compatibility threshold", async () => {
    const target = await container.songService.create({ ...base, title: "Target" });
    // Same verse shape in another key => identical degrees => verse->verse = 1.
    await container.songService.create({
      ...base,
      title: "Match",
      scale: "G",
      verseChords: "G, D, Em, C",
      chorusChords: "C, G, D, Em",
    });
    // Different verse AND chorus => below threshold on every rule.
    await container.songService.create({
      ...base,
      title: "NoMatch",
      verseChords: "Cmaj7, Dm7, Em7, Fmaj7",
      chorusChords: "Dm7, Em7, Fmaj7, G7",
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions.map((s) => s.song.title)).toEqual(["Match"]);
    expect(suggestions[0]!.score).toBeGreaterThanOrEqual(COMPATIBILITY_THRESHOLD);
    expect(suggestions[0]!.bestMatch).toEqual({ source: "verse", target: "verse", similarity: 1 });
  });

  it("qualifies a candidate whose chorus matches the target verse (cross-section)", async () => {
    const target = await container.songService.create({ ...base, title: "Target" });
    await container.songService.create({
      ...base,
      title: "ChorusMatch",
      verseChords: "Cmaj7, Dm7, Em7, Fmaj7", // unrelated verse
      chorusChords: "C, G, Am, F", // == target verse degrees [1,5,6m,4]
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions.map((s) => s.song.title)).toEqual(["ChorusMatch"]);
    expect(suggestions[0]!.bestMatch.target).toBe("chorus");
    expect(suggestions[0]!.score).toBe(1);
  });

  it("qualifies a candidate whose alternate verse matches the target verse", async () => {
    const target = await container.songService.create({ ...base, title: "Target" });
    await container.songService.create({
      ...base,
      title: "AltMatch",
      verseChords: "Cmaj7, Dm7, Em7, Fmaj7",
      chorusChords: "Dm7, Em7, Fmaj7, G7",
      alternateVerseChords: "C, G, Am, F", // == target verse
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions.map((s) => s.song.title)).toEqual(["AltMatch"]);
    expect(suggestions[0]!.bestMatch.target).toBe("alternateVerse");
  });

  it("ranks a higher-scoring candidate above a closer-BPM one", async () => {
    const target = await container.songService.create({
      ...base,
      title: "Target",
      bpm: 120,
    });
    // Perfect verse match, but far BPM.
    await container.songService.create({
      ...base,
      title: "HighScoreFarBpm",
      bpm: 150,
      verseChords: "C, G, Am, F", // == target verse => score 1
    });
    // One chord off (3/4 tokens match => 0.75), but nearly identical BPM.
    await container.songService.create({
      ...base,
      title: "LowScoreCloseBpm",
      bpm: 121,
      verseChords: "C, G, Am, Dm", // one token differs => score 0.75
      chorusChords: "Dm7, Em7, Fmaj7, G7", // no better cross-section match
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions.map((s) => s.song.title)).toEqual([
      "HighScoreFarBpm",
      "LowScoreCloseBpm",
    ]);
    expect(suggestions[0]!.score).toBeGreaterThan(suggestions[1]!.score);
  });

  it("returns only the top 5 highest-scoring suggestions", async () => {
    const target = await container.songService.create({
      ...base,
      title: "Target",
      bpm: 120,
    });
    // Five perfect matches (score 1), distinct BPMs so ordering is deterministic.
    for (let i = 0; i < 5; i++) {
      await container.songService.create({
        ...base,
        title: `HighScore${i}`,
        bpm: 130 + i,
        verseChords: "C, G, Am, F", // == target verse => score 1
      });
    }
    // A lower-scoring song with the closest BPM: under the old BPM-first rule it
    // would have led the list; now it ranks last and is dropped by the top-5 cap.
    await container.songService.create({
      ...base,
      title: "SneakyCloseBpm",
      bpm: 121,
      verseChords: "C, G, Am, Dm", // score 0.75
      chorusChords: "Dm7, Em7, Fmaj7, G7",
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions).toHaveLength(5);
    const titles = suggestions.map((s) => s.song.title);
    expect(titles).not.toContain("SneakyCloseBpm");
    expect(titles).toEqual([
      "HighScore0",
      "HighScore1",
      "HighScore2",
      "HighScore3",
      "HighScore4",
    ]);
  });

  it("ranks equal-score candidates by BPM, then scale, then language", async () => {
    const target = await container.songService.create({
      ...base,
      title: "Target",
      bpm: 120,
      scale: "C",
      language: "English",
    });
    await container.songService.create({
      ...base,
      title: "FarBpm",
      bpm: 150,
      scale: "C",
      language: "English",
    });
    await container.songService.create({
      ...base,
      title: "CloseBpmOtherScale",
      bpm: 121,
      scale: "G",
      language: "Italian",
      verseChords: "G, D, Em, C",
      chorusChords: "C, G, D, Em",
    });
    await container.songService.create({
      ...base,
      title: "CloseBpmSameScale",
      bpm: 122,
      scale: "C",
      language: "French",
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions.map((s) => s.song.title)).toEqual([
      "CloseBpmOtherScale",
      "CloseBpmSameScale",
      "FarBpm",
    ]);
  });

  it("throws for an unknown target song", async () => {
    await expect(container.suggestionService.getSuggestions("missing")).rejects.toThrow();
  });
});
