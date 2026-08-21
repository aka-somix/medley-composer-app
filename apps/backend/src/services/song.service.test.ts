import { beforeEach, describe, it, expect } from "vitest";
import { createContainer, type Container } from "../container.js";

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

describe("SongService.create", () => {
  let container: Container;
  beforeEach(async () => {
    container = await makeContainer();
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

describe("SongService.createMany", () => {
  let container: Container;
  beforeEach(async () => {
    container = await makeContainer();
  });

  const valid = (over: Record<string, unknown> = {}) => ({
    title: "T",
    artist: "A",
    bpm: 100,
    scale: "C",
    language: "English",
    verseChords: "C, G",
    chorusChords: "F, C",
    ...over,
  });

  it("imports every valid row and reports no errors", async () => {
    const result = await container.songService.createMany([
      valid({ title: "One" }),
      valid({ title: "Two" }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.created.map((s) => s.title)).toEqual(["One", "Two"]);
    expect(result.created[0]!.verseDegrees).toEqual(["1", "5"]);
  });

  it("skips a row with invalid chords, reports its 1-based row, and imports the rest", async () => {
    const result = await container.songService.createMany([
      valid({ title: "Good" }),
      valid({ title: "Bad", verseChords: "C, Zork, F" }),
      valid({ title: "AlsoGood" }),
    ]);

    expect(result.created.map((s) => s.title)).toEqual(["Good", "AlsoGood"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(2);
    expect(result.errors[0]!.message).toMatch(/zork/i);
  });

  it("skips a row that fails schema validation and reports its row", async () => {
    const result = await container.songService.createMany([
      valid({ title: "" }),
      valid({ title: "Fine" }),
    ]);

    expect(result.created.map((s) => s.title)).toEqual(["Fine"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(1);
  });

  it("upserts a row whose title+artist match an existing song, keeping its id and createdAt", async () => {
    const seed = await container.songService.createMany([
      valid({ title: "Hey Jude", artist: "The Beatles", bpm: 100 }),
    ]);
    const first = seed.created[0]!;

    const result = await container.songService.createMany([
      valid({ title: "Hey Jude", artist: "The Beatles", bpm: 150, verseChords: "Am, F" }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]!.id).toBe(first.id);
    expect(result.created[0]!.createdAt).toBe(first.createdAt);
    expect(result.created[0]!.bpm).toBe(150);
    expect(result.created[0]!.verseDegrees).toEqual(["6m", "4"]);

    // No duplicate persisted.
    const page = await container.songService.list(1, 20);
    expect(page.total).toBe(1);
  });

  it("matches an existing song case-insensitively and after trimming", async () => {
    const seed = await container.songService.createMany([
      valid({ title: "Hey Jude", artist: "The Beatles" }),
    ]);
    const first = seed.created[0]!;

    const result = await container.songService.createMany([
      valid({ title: "  hey jude  ", artist: "the BEATLES", bpm: 200 }),
    ]);

    expect(result.created).toHaveLength(1);
    expect(result.created[0]!.id).toBe(first.id);
    expect(result.created[0]!.bpm).toBe(200);

    const page = await container.songService.list(1, 20);
    expect(page.total).toBe(1);
  });

  it("lets the last row win for duplicate title+artist within one batch", async () => {
    const result = await container.songService.createMany([
      valid({ title: "Dup", artist: "A", bpm: 100 }),
      valid({ title: "DUP", artist: "a", bpm: 175, verseChords: "Am, F" }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]!.bpm).toBe(175);
    expect(result.created[0]!.verseDegrees).toEqual(["6m", "4"]);

    const page = await container.songService.list(1, 20);
    expect(page.total).toBe(1);
  });
});
