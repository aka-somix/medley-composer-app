import { beforeEach, describe, it, expect } from "vitest";
import { createContainer, type Container } from "../container.js";

let seq = 0;
function makeContainer(): Container {
  seq = 0;
  return createContainer({
    generateId: () => `id-${++seq}`,
    now: () => "2026-08-17T00:00:00.000Z",
  });
}

describe("SongService.create", () => {
  let container: Container;
  beforeEach(() => {
    container = makeContainer();
  });

  it("translates chords into degree tokens in the song's scale", async () => {
    const song = await container.songService.create({
      title: "Cream Sky",
      artist: "The Grooves",
      bpm: 120,
      scale: "C",
      language: "English",
      verseChords: "C, G, Dm, FM7",
      chorusChords: "F, C, G, Am",
      bridgeChords: null,
    });

    expect(song.verseDegrees).toEqual(["1", "5", "2m", "4M7"]);
    expect(song.chorusDegrees).toEqual(["4", "1", "5", "6m"]);
    expect(song.bridgeDegrees).toBeNull();
    expect(song.id).toBe("id-1");
    expect(song.createdAt).toBe("2026-08-17T00:00:00.000Z");
  });

  it("translates an optional bridge when provided", async () => {
    const song = await container.songService.create({
      title: "With Bridge",
      artist: "A",
      bpm: 100,
      scale: "G",
      language: "English",
      verseChords: "G, D",
      chorusChords: "C, G",
      bridgeChords: "Em, C, G, D",
    });
    expect(song.bridgeDegrees).toEqual(["6m", "4", "1", "5"]);
  });

  it("translates an optional alternate verse when provided", async () => {
    const song = await container.songService.create({
      title: "Alt Verse Song",
      artist: "A",
      bpm: 100,
      scale: "C",
      language: "English",
      verseChords: "C, G, Am, F",
      chorusChords: "F, C, G, Am",
      bridgeChords: null,
      alternateVerseChords: "Am, F, C, G",
    });
    expect(song.alternateVerseDegrees).toEqual(["6m", "4", "1", "5"]);
  });

  it("leaves alternateVerseDegrees null when omitted", async () => {
    const song = await container.songService.create({
      title: "No Alt",
      artist: "A",
      bpm: 100,
      scale: "C",
      language: "English",
      verseChords: "C, G",
      chorusChords: "F, C",
      bridgeChords: null,
    });
    expect(song.alternateVerseDegrees).toBeNull();
  });

  it("paginates and searches by title", async () => {
    for (const title of ["Alpha", "Beta", "Alpha Reprise"]) {
      await container.songService.create({
        title,
        artist: "A",
        bpm: 100,
        scale: "C",
        language: "English",
        verseChords: "C, G",
        chorusChords: "F, C",
        bridgeChords: null,
      });
    }
    const page = await container.songService.list(1, 2);
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);

    const results = await container.songService.search("alpha");
    expect(results.map((s) => s.title).sort()).toEqual(["Alpha", "Alpha Reprise"]);
  });
});
