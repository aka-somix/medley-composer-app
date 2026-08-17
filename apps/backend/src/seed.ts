import { createContainer } from "./container.js";
import type { CreateSongBody } from "./validation.js";

/** Sample library. Many songs share the I–V–vi–IV shape so chaining is demonstrable. */
const SEED_SONGS: CreateSongBody[] = [
  {
    title: "Cream Sky",
    artist: "The Grooves",
    bpm: 120,
    scale: "C",
    language: "English",
    verseChords: "C, G, Am, F",
    chorusChords: "F, C, G, Am",
    bridgeChords: "Dm, Em, F, G",
  },
  {
    title: "Velvet Morning",
    artist: "Luna Fields",
    bpm: 122,
    scale: "G",
    language: "English",
    verseChords: "G, D, Em, C",
    chorusChords: "C, G, D, Em",
    bridgeChords: null,
  },
  {
    title: "Blue Static",
    artist: "Echoes",
    bpm: 121,
    scale: "A",
    language: "English",
    verseChords: "A, E, F#m, D",
    chorusChords: "D, A, E, F#m",
    bridgeChords: "Bm, C#m, D, E",
  },
  {
    title: "Notturno",
    artist: "Marconi",
    bpm: 100,
    scale: "D",
    language: "Italian",
    verseChords: "D, A, Bm, G",
    chorusChords: "G, D, A, Bm",
    bridgeChords: null,
  },
  {
    title: "Distant Drums",
    artist: "Pale Horizon",
    bpm: 90,
    scale: "E",
    language: "English",
    verseChords: "E, B, C#m, A",
    chorusChords: "A, E, B, C#m",
    bridgeChords: null,
  },
  {
    title: "Smoke Ring",
    artist: "The Reels",
    bpm: 128,
    scale: "F",
    language: "English",
    verseChords: "F, C, Dm, Bb",
    chorusChords: "Bb, F, C, Dm",
    bridgeChords: null,
  },
  {
    title: "Jazz Alley",
    artist: "Miles Ahead",
    bpm: 140,
    scale: "C",
    language: "English",
    verseChords: "Cmaj7, Dm7, Em7, Fmaj7",
    chorusChords: "Dm7, G7, Cmaj7, Am7",
    bridgeChords: null,
  },
  {
    title: "Midnight Cafe",
    artist: "Nocturne",
    bpm: 75,
    scale: "C",
    language: "French",
    verseChords: "Am, F, C, G",
    chorusChords: "F, G, Am, C",
    bridgeChords: null,
  },
];

async function main(): Promise<void> {
  const dbLocation = process.env.DB_LOCATION ?? "./medleys.sqlite";
  const container = createContainer({ dbLocation });

  container.database?.raw.exec("DELETE FROM songs");
  for (const song of SEED_SONGS) {
    await container.songService.create(song);
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${SEED_SONGS.length} songs into ${dbLocation}`);
  container.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
