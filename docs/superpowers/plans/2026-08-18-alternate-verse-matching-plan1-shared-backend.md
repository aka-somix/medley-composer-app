# Alternate Verse & Rule-Based Matching — Plan 1 (Shared + Backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `alternateVerse` song section and replace hard-coded verse/chorus matching with a versioned list of section-comparison rules whose result records which section pair won.

**Architecture:** Domain types and the pure matching evaluator live in `@medleys/shared`. The backend imports `evaluateMatch`/`ACTIVE_MATCH_RULES` (never re-implementing similarity) and keeps its layered flow route → controller → service → repository. The DB schema is raw SQL in `ensureSchema()` (no drizzle-kit).

**Tech Stack:** TypeScript (strict, ESM with `.js` import specifiers), Vitest, Express, Drizzle ORM + better-sqlite3, zod.

**Spec:** `docs/superpowers/specs/2026-08-18-alternate-verse-and-match-chip-spec1-shared-backend.md`

## Global Constraints

- ESM everywhere; import local files with the `.js` extension. Strict TS, no `any`. (`.claude/rules/shared.md`, `.claude/rules/backend.md`)
- `@medleys/shared` stays pure: no I/O, no framework imports. Every export unit-tested. (`.claude/rules/shared.md`)
- Degree token format is `[accidentals][single digit 1-7][quality suffix]`; quality suffixes preserved verbatim. Do not change token format or the similarity metric. (`.claude/rules/shared.md`)
- Never re-implement chord/degree math or similarity in the backend — import from `@medleys/shared`. (`.claude/rules/backend.md`)
- `COMPATIBILITY_THRESHOLD = 0.5`; the threshold applies to a suggestion's `score`.
- Matching rules live in exactly one editable place: `ACTIVE_MATCH_RULES` in `packages/shared/src/music/matching.ts`.
- Backend TDD: write the test first; service tests use `createContainer({ generateId, now })`; endpoint tests use supertest against `createApp`.
- Vitest strips types (no typecheck). The cross-package type gate is `pnpm --filter @medleys/backend run typecheck` — run it as the final step of each backend task.

---

### Task 1: Shared domain types + rule-based matching evaluator

**Files:**
- Modify: `packages/shared/src/types.ts`
- Create: `packages/shared/src/music/matching.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/music/matching.test.ts`

**Interfaces:**
- Produces (consumed by all later tasks and by Plan 2):
  - `type SongSection = "verse" | "chorus" | "bridge" | "alternateVerse"`
  - `interface ComparisonRule { source: SongSection; target: SongSection }`
  - `interface SectionMatch { source: SongSection; target: SongSection; similarity: number }`
  - `Song.alternateVerseDegrees: DegreeProgression | null` (new required property)
  - `CreateSongInput.alternateVerseChords?: string | null`
  - `Suggestion { song: Song; score: number; bestMatch: SectionMatch; matches: SectionMatch[] }` (reshaped — `verseSimilarity`/`chorusSimilarity` removed)
  - `MATCH_RULES_V1: readonly ComparisonRule[]`, `ACTIVE_MATCH_RULES: readonly ComparisonRule[]`
  - `sectionDegrees(song: Song, section: SongSection): DegreeProgression`
  - `evaluateMatch(source: Song, candidate: Song, rules?: readonly ComparisonRule[]): { best: SectionMatch; matches: SectionMatch[] }`

> NOTE: This task removes `verseSimilarity`/`chorusSimilarity` from `Suggestion` and makes `Song.alternateVerseDegrees` required. The backend will not typecheck again until Tasks 2 and 3 land — that is expected and called out in the Global Constraints. This task's gate is the **shared** test suite only.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/music/matching.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/shared test`
Expected: FAIL — `./matching.js` does not exist / exports missing.

- [ ] **Step 3: Extend the shared types**

In `packages/shared/src/types.ts`, add the new section type near the top (after `DegreeProgression`):

```ts
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
```

Add the new section to `Song` (after `bridgeDegrees`):

```ts
  bridgeDegrees: DegreeProgression | null;
  alternateVerseDegrees: DegreeProgression | null;
```

Add to `CreateSongInput` (after `bridgeChords`):

```ts
  bridgeChords?: string | null;
  alternateVerseChords?: string | null;
```

Replace the `Suggestion` interface with:

```ts
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
```

- [ ] **Step 4: Create the matching module**

Create `packages/shared/src/music/matching.ts`:

```ts
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
```

- [ ] **Step 5: Re-export from the package index**

In `packages/shared/src/index.ts`, add the matching module export:

```ts
export * from "./types.js";
export * from "./music/chords.js";
export * from "./music/similarity.js";
export * from "./music/matching.js";
export * from "./music/errors.js";
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @medleys/shared test`
Expected: PASS (new matching suite + existing similarity/chords suites all green).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/music/matching.ts packages/shared/src/music/matching.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add alternateVerse section and rule-based match evaluator"
```

---

### Task 2: Backend — persist and translate the alternate verse

**Files:**
- Modify: `apps/backend/src/db/schema.ts`
- Modify: `apps/backend/src/db/client.ts:26-42` (`ensureSchema`)
- Modify: `apps/backend/src/repositories/drizzle-song.repository.ts:7-20` (`toSong`)
- Modify: `apps/backend/src/validation.ts:9-18` (`createSongSchema`)
- Modify: `apps/backend/src/services/song.service.ts` (`create`, `update`)
- Test: `apps/backend/src/services/song.service.test.ts`

**Interfaces:**
- Consumes: `Song.alternateVerseDegrees`, `CreateSongInput.alternateVerseChords` (Task 1); `translateSection` (existing in `song.service.ts`), `chordsToDegrees`, `parseProgression` (`@medleys/shared`).
- Produces: songs round-trip an optional `alternateVerseDegrees` column; `CreateSongBody`/`UpdateSongBody` include `alternateVerseChords`.

- [ ] **Step 1: Write the failing test**

Add to `apps/backend/src/services/song.service.test.ts` inside `describe("SongService.create", ...)`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/backend test src/services/song.service.test.ts`
Expected: FAIL — `alternateVerseDegrees` is `undefined` (not persisted/translated yet).

- [ ] **Step 3: Add the DB column (Drizzle schema)**

In `apps/backend/src/db/schema.ts`, add after the `bridgeDegrees` line:

```ts
  bridgeDegrees: text("bridge_degrees", { mode: "json" }).$type<string[] | null>(),
  alternateVerseDegrees: text("alternate_verse_degrees", { mode: "json" }).$type<string[] | null>(),
```

- [ ] **Step 4: Create the column in `ensureSchema`**

Replace the body of `ensureSchema` in `apps/backend/src/db/client.ts` with:

```ts
function ensureSchema(raw: Database.Database): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      bpm INTEGER NOT NULL,
      scale TEXT NOT NULL,
      language TEXT NOT NULL,
      verse_degrees TEXT NOT NULL,
      chorus_degrees TEXT NOT NULL,
      bridge_degrees TEXT,
      alternate_verse_degrees TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs (title);
  `);
  // Add the column to pre-existing databases created before this field existed.
  try {
    raw.exec("ALTER TABLE songs ADD COLUMN alternate_verse_degrees TEXT");
  } catch {
    /* column already exists */
  }
}
```

- [ ] **Step 5: Map the column in `toSong`**

In `apps/backend/src/repositories/drizzle-song.repository.ts`, add to the `toSong` return object after `bridgeDegrees`:

```ts
    bridgeDegrees: row.bridgeDegrees ?? null,
    alternateVerseDegrees: row.alternateVerseDegrees ?? null,
```

- [ ] **Step 6: Add validation**

In `apps/backend/src/validation.ts`, add to `createSongSchema` after `bridgeChords`:

```ts
  bridgeChords: z.string().trim().nullish(),
  alternateVerseChords: z.string().trim().nullish(),
```

(`updateSongSchema = createSongSchema.partial()` picks it up automatically.)

- [ ] **Step 7: Translate on create and update**

In `apps/backend/src/services/song.service.ts` `create`, add after `bridgeDegrees`:

```ts
      bridgeDegrees: translateSection(input.bridgeChords, input.scale),
      alternateVerseDegrees: translateSection(input.alternateVerseChords, input.scale),
```

In `update`, add after the `bridgeChords` block:

```ts
    if (input.bridgeChords !== undefined)
      patch.bridgeDegrees = translateSection(input.bridgeChords, scale);
    if (input.alternateVerseChords !== undefined)
      patch.alternateVerseDegrees = translateSection(input.alternateVerseChords, scale);
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter @medleys/backend test src/services/song.service.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @medleys/backend run typecheck`
Expected: still FAILS in `suggestion.service.ts` only (it still builds the old `Suggestion` shape). That file is fixed in Task 3. No other errors should appear.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/db/schema.ts apps/backend/src/db/client.ts apps/backend/src/repositories/drizzle-song.repository.ts apps/backend/src/validation.ts apps/backend/src/services/song.service.ts apps/backend/src/services/song.service.test.ts
git commit -m "feat(backend): persist and translate optional alternate verse chords"
```

---

### Task 3: Backend — rule-based suggestions returning the matched section

**Files:**
- Modify: `apps/backend/src/services/suggestion.service.ts`
- Test: `apps/backend/src/services/suggestion.service.test.ts`
- Test: `apps/backend/src/app.test.ts:71-88`

**Interfaces:**
- Consumes: `evaluateMatch`, `COMPATIBILITY_THRESHOLD`, `Suggestion`, `SectionMatch` (`@medleys/shared`); `SongRepository` (existing).
- Produces: `SuggestionService.getSuggestions(songId) => Promise<Suggestion[]>` where each item is `{ song, score, bestMatch, matches }`, filtered by `score >= COMPATIBILITY_THRESHOLD`, ranked BPM → scale → language.

- [ ] **Step 1: Rewrite the failing test**

Replace the body of `apps/backend/src/services/suggestion.service.test.ts` with:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { createContainer, type Container } from "../container.js";
import type { CreateSongBody } from "../validation.js";
import { COMPATIBILITY_THRESHOLD } from "@medleys/shared";

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

  it("ranks by BPM, then scale, then language", async () => {
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/backend test src/services/suggestion.service.test.ts`
Expected: FAIL — `bestMatch` is `undefined` (service still returns the old shape).

- [ ] **Step 3: Rewrite the suggestion service**

Replace `apps/backend/src/services/suggestion.service.ts` with:

```ts
import {
  COMPATIBILITY_THRESHOLD,
  evaluateMatch,
  type Song,
  type Suggestion,
} from "@medleys/shared";
import type { SongRepository } from "../repositories/song.repository.js";
import { NotFoundError } from "../http/errors.js";

/**
 * Finds songs compatible with a target song for medley chaining.
 *
 * Compatibility is decided by ACTIVE_MATCH_RULES (see @medleys/shared): a
 * candidate's score is the best similarity across the active section-comparison
 * rules, and bestMatch records which section pair won. Survivors (score >=
 * COMPATIBILITY_THRESHOLD) are ranked by, in order:
 *   1. closest BPM (highest priority)
 *   2. same music scale
 *   3. same language (lowest priority)
 * Ranking only sorts — every compatible song is returned.
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
    return compatible;
  }

  private score(target: Song, candidate: Song): Suggestion {
    const { best, matches } = evaluateMatch(target, candidate);
    return { song: candidate, score: best.similarity, bestMatch: best, matches };
  }

  private compare(target: Song, a: Suggestion, b: Suggestion): number {
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @medleys/backend test src/services/suggestion.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the endpoint test still asserts the right shape**

The existing `apps/backend/src/app.test.ts` suggestions test only asserts `res.body[0].song.title === "Match"`, which still holds. Add one assertion for the new field. In `apps/backend/src/app.test.ts`, inside the `GET /api/songs/:id/suggestions` test after the existing expectations, add:

```ts
    expect(res.body[0].bestMatch.target).toBe("verse");
    expect(res.body[0]).not.toHaveProperty("verseSimilarity");
```

- [ ] **Step 6: Run the full backend suite + typecheck**

Run: `pnpm --filter @medleys/backend test`
Expected: PASS (all suites).
Run: `pnpm --filter @medleys/backend run typecheck`
Expected: PASS (no errors — the old `Suggestion` fields are fully gone).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/services/suggestion.service.ts apps/backend/src/services/suggestion.service.test.ts apps/backend/src/app.test.ts
git commit -m "feat(backend): rule-based suggestions returning the matched section"
```

---

### Task 4: Seed sample alternate verses (optional, demo data)

**Files:**
- Modify: `apps/backend/src/seed.ts`

**Interfaces:**
- Consumes: `CreateSongInput.alternateVerseChords`.
- Produces: at least one seeded song with a non-null alternate verse so the feature is demonstrable end-to-end.

- [ ] **Step 1: Add an alternate verse to a seed song**

Open `apps/backend/src/seed.ts`, find the sample-song array, and add `alternateVerseChords: "…"` (comma-separated chords in that song's own scale) to one or two entries. Keep the values consistent with each song's `scale`.

- [ ] **Step 2: Run the seed to verify it succeeds**

Run: `pnpm --filter @medleys/backend run seed`
Expected: completes without error; seeded song has `alternateVerseDegrees` populated.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/seed.ts
git commit -m "chore(backend): seed a sample alternate verse"
```

---

## Self-review notes

- **Spec coverage:** A1 types → Task 1 Step 3; A2 matching module → Task 1 Steps 4–6; A3 re-exports → Task 1 Step 5; A4 shared tests → Task 1. B1 schema/migration → Task 2 Steps 3–4; B2 repo mapper → Task 2 Step 5; B3 validation → Task 2 Step 6; B4 service translate → Task 2 Step 7; B5 suggestion rewrite → Task 3; B6 seed → Task 4; B7 backend tests → Tasks 2–3.
- **Threshold wording fix (spec B7):** handled — the rewritten suggestion test asserts against `COMPATIBILITY_THRESHOLD` instead of the stale `0.7`.
- **Type consistency:** `bestMatch` / `matches` / `SectionMatch{source,target,similarity}` / `evaluateMatch` / `sectionDegrees` names are identical across Task 1 (definition), Task 3 (use), and the tests.

## Coordination with Plan 2 (Frontend)

Land Task 1 (the `packages/shared` changes) before Plan 2 runs its typecheck/build — Plan 2 imports the reshaped `Suggestion` and the new `Song`/`CreateSongInput` fields. The type contract in Task 1's Interfaces block is reproduced verbatim in Plan 2 so both agents implement the identical shape.
