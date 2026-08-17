import { beforeEach, describe, it, expect } from "vitest";
import { createContainer, type Container } from "../container.js";
import type { CreateSongBody } from "../validation.js";

let seq = 0;
function makeContainer(): Container {
  seq = 0;
  return createContainer({
    generateId: () => `id-${++seq}`,
    now: () => "2026-08-17T00:00:00.000Z",
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
  beforeEach(() => {
    container = makeContainer();
  });

  it("returns only songs with >=70% verse or chorus similarity", async () => {
    const target = await container.songService.create({ ...base, title: "Target" });
    // Same shape in a different key => identical degrees => compatible.
    await container.songService.create({
      ...base,
      title: "Match",
      scale: "G",
      verseChords: "G, D, Em, C",
      chorusChords: "C, G, D, Em",
    });
    // Totally different progression => not compatible.
    await container.songService.create({
      ...base,
      title: "NoMatch",
      verseChords: "Cmaj7, Dm7, Em7, Fmaj7",
      chorusChords: "Dm7, G7, Cmaj7, Am7",
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions.map((s) => s.song.title)).toEqual(["Match"]);
    expect(suggestions[0]!.score).toBeGreaterThanOrEqual(0.7);
  });

  it("qualifies a candidate on chorus similarity alone", async () => {
    const target = await container.songService.create({ ...base, title: "Target" });
    await container.songService.create({
      ...base,
      title: "ChorusOnly",
      verseChords: "C, Dm, Em, F", // different verse (1,2m,3m,4)
      chorusChords: "F, C, G, Am", // identical chorus
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    expect(suggestions.map((s) => s.song.title)).toEqual(["ChorusOnly"]);
    expect(suggestions[0]!.chorusSimilarity).toBe(1);
  });

  it("ranks by BPM, then scale, then language", async () => {
    const target = await container.songService.create({
      ...base,
      title: "Target",
      bpm: 120,
      scale: "C",
      language: "English",
    });
    // All compatible (same degree shape via different keys/BPMs).
    await container.songService.create({
      ...base,
      title: "FarBpm",
      bpm: 150,
      scale: "C",
      language: "English",
      verseChords: "C, G, Am, F",
      chorusChords: "F, C, G, Am",
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
      verseChords: "C, G, Am, F",
      chorusChords: "F, C, G, Am",
    });

    const suggestions = await container.suggestionService.getSuggestions(target.id);
    // 121 and 122 both beat 150; among them same-scale (C) wins the scale tiebreak
    // despite being 1 BPM further, because BPM is compared first: 121 < 122.
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
