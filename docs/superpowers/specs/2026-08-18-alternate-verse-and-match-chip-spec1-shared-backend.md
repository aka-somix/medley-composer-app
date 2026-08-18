# Spec 1 — Shared domain + Backend: Alternate verse & rule-based matching

**Date:** 2026-08-18
**Owns:** `packages/shared`, `apps/backend`
**Sibling spec:** Spec 2 (Frontend) — `2026-08-18-alternate-verse-and-match-chip-spec2-frontend.md`

## Goal

Two changes to the domain and matching engine:

1. Add a new **optional** song section, `alternateVerse`, alongside the existing
   `verse` / `chorus` / `bridge`.
2. Replace the hard-coded verse-vs-verse / chorus-vs-chorus matching with a
   **versioned list of section-comparison rules**. A suggestion's score is the
   best similarity across the active rules, and the result records **which
   section pair won** so the UI can show a "matching part" chip.

The eventual goal is all-sections × all-sections comparison. For **V1** the
active rules are exactly:

```
verse → verse
verse → chorus
verse → alternateVerse
```

(source song's section → suggested song's section). The rule list is defined in
one place so it can be extended later by editing a single array.

`bridge` remains stored and displayed but is **not** part of V1 matching.

---

## Part A — `@medleys/shared` changes

All new types/functions are pure (no I/O) and re-exported from
`packages/shared/src/index.ts`. Follow `.claude/rules/shared.md`.

### A1. New types (`packages/shared/src/types.ts`)

Add:

```ts
export type SongSection = "verse" | "chorus" | "bridge" | "alternateVerse";

export interface ComparisonRule {
  source: SongSection; // section on the source song
  target: SongSection; // section on the candidate (suggested) song
}

export interface SectionMatch {
  source: SongSection;
  target: SongSection;
  similarity: number; // [0,1]
}
```

Extend `Song` with the new optional section (place next to `bridgeDegrees`):

```ts
export interface Song {
  // ...existing fields...
  verseDegrees: DegreeProgression;
  chorusDegrees: DegreeProgression;
  bridgeDegrees: DegreeProgression | null;
  alternateVerseDegrees: DegreeProgression | null; // NEW
  createdAt: string;
}
```

Extend `CreateSongInput` (raw chord strings, in the song's own scale):

```ts
export interface CreateSongInput {
  // ...existing fields...
  verseChords: string;
  chorusChords: string;
  bridgeChords?: string | null;
  alternateVerseChords?: string | null; // NEW, optional
}
```

**Reshape `Suggestion`** (breaking change — replace `verseSimilarity` /
`chorusSimilarity`):

```ts
export interface Suggestion {
  song: Song;
  score: number;           // = bestMatch.similarity; COMPATIBILITY_THRESHOLD applies here
  bestMatch: SectionMatch; // the winning rule — drives the UI chip
  matches: SectionMatch[]; // every evaluated rule, in rule order (detail / future use)
}
```

`COMPATIBILITY_THRESHOLD` stays `0.5`.

### A2. Versioned rules + evaluator (new file `packages/shared/src/music/matching.ts`)

```ts
import type { Song, SongSection, ComparisonRule, SectionMatch, DegreeProgression } from "../types.js";
import { progressionSimilarity } from "./similarity.js";

export const MATCH_RULES_V1: readonly ComparisonRule[] = [
  { source: "verse", target: "verse" },
  { source: "verse", target: "chorus" },
  { source: "verse", target: "alternateVerse" },
];

// The single switch point. Change this (or add a V2 array) to change matching.
export const ACTIVE_MATCH_RULES: readonly ComparisonRule[] = MATCH_RULES_V1;

export function sectionDegrees(song: Song, section: SongSection): DegreeProgression {
  switch (section) {
    case "verse": return song.verseDegrees;
    case "chorus": return song.chorusDegrees;
    case "bridge": return song.bridgeDegrees ?? [];
    case "alternateVerse": return song.alternateVerseDegrees ?? [];
  }
}

export function evaluateMatch(
  source: Song,
  candidate: Song,
  rules: readonly ComparisonRule[] = ACTIVE_MATCH_RULES,
): { best: SectionMatch; matches: SectionMatch[] } {
  const matches: SectionMatch[] = rules.map((r) => ({
    source: r.source,
    target: r.target,
    similarity: progressionSimilarity(
      sectionDegrees(source, r.source),
      sectionDegrees(candidate, r.target),
    ),
  }));
  // First rule wins on ties (rule order = priority).
  let best = matches[0];
  for (const m of matches) if (m.similarity > best.similarity) best = m;
  return { best, matches };
}
```

Notes:
- A `null`/absent target section (e.g. candidate has no alternate verse) becomes
  `[]`, so `progressionSimilarity(nonEmpty, [])` returns `0` — it simply never
  wins. No special casing.
- `rules` must be non-empty (all V1 rules are); `evaluateMatch` assumes at least
  one rule.

### A3. Re-exports (`packages/shared/src/index.ts`)

Export the new types (`SongSection`, `ComparisonRule`, `SectionMatch`) and
everything from `music/matching.ts` (`MATCH_RULES_V1`, `ACTIVE_MATCH_RULES`,
`sectionDegrees`, `evaluateMatch`).

### A4. Shared tests (TDD — write first)

`packages/shared/src/music/matching.test.ts`:
- `sectionDegrees` returns the right array per section; `bridge`/`alternateVerse`
  `null` → `[]`.
- `evaluateMatch` with V1 rules:
  - picks the highest-similarity rule as `best`; `matches` has one entry per
    active rule in rule order.
  - first rule wins on an exact tie.
  - candidate with `alternateVerseDegrees: null` → that rule scores `0`.
  - a candidate whose **chorus** equals the source's **verse** produces
    `best = { source: "verse", target: "chorus", similarity: 1 }` (proves
    cross-section matching works).
- Existing `similarity.test.ts` / `chords.test.ts` stay green (no changes to
  those functions). `pnpm --filter @medleys/shared test` green.

---

## Part B — `apps/backend` changes

Follow `.claude/rules/backend.md` (layered, DI, zod validation, TDD, ESM `.js`
imports). Never re-implement similarity/matching here — import from
`@medleys/shared`.

### B1. DB schema + migration (`apps/backend/src/db/schema.ts`)

Add a nullable JSON column mirroring `bridge_degrees`:

```ts
alternateVerseDegrees: text("alternate_verse_degrees", { mode: "json" }).$type<string[] | null>(),
```

Generate/author a migration using the repo's existing Drizzle migration
mechanism (inspect `drizzle.config.*`, any `migrations/` folder, and how the DB
is created/migrated on boot — match that approach). The column is nullable with
no default, so existing rows are unaffected.

### B2. Repository mapper (`apps/backend/src/repositories/drizzle-song.repository.ts`)

In `toSong(row)`, map `alternateVerseDegrees: row.alternateVerseDegrees ?? null`
(same pattern as `bridgeDegrees`). No interface signature change — `update` still
takes `Partial<Omit<Song, "id" | "createdAt">>`, which now includes the new
field automatically.

### B3. Validation (`apps/backend/src/validation.ts`)

Add to `createSongSchema` (optional/nullable, like `bridgeChords`):

```ts
alternateVerseChords: z.string().trim().nullish(),
```

`updateSongSchema = createSongSchema.partial()` picks it up automatically.

### B4. Song service (`apps/backend/src/services/song.service.ts`)

- In `create`, translate `alternateVerseChords` the same way bridge is handled
  via `translateSection` (null/empty → `null`, else
  `chordsToDegrees(parseProgression(raw), scale)`), writing
  `alternateVerseDegrees`.
- In `update`, re-translate `alternateVerse` only when `alternateVerseChords` was
  provided in the input, using `input.scale ?? existing.scale` (mirror the
  existing bridge logic exactly).

### B5. Suggestion service (`apps/backend/src/services/suggestion.service.ts`)

Rewrite `getSuggestions` to use the shared evaluator:

- For each candidate (excluding self), call `evaluateMatch(target, candidate)`.
- Build `Suggestion { song, score: best.similarity, bestMatch: best, matches }`.
- Keep those with `score >= COMPATIBILITY_THRESHOLD`.
- Ranking (`compare`) is **unchanged**: BPM proximity → same scale → same
  language. Ranking only sorts; every song passing the threshold is returned.

Remove the old `verseSimilarity`/`chorusSimilarity` construction.

### B6. Seed data (`apps/backend/src/seed.ts`)

Optional but recommended: give a couple of seed songs an `alternateVerseChords`
so the feature is demonstrable. Not required for correctness.

### B7. Backend tests (TDD — write/adjust first)

- `apps/backend/src/services/suggestion.service.test.ts` — rewrite for the new
  `Suggestion` shape:
  - a candidate qualifying via a **cross-section** rule (its chorus equals the
    target's verse) is returned with `bestMatch.target === "chorus"`.
  - a candidate qualifying via `verse → alternateVerse`.
  - threshold filtering on `score`.
  - BPM → scale → language ranking order preserved.
  - Fix the stale "70%"/`0.7` wording/assertion to reflect the real `0.5`
    threshold.
- `apps/backend/src/services/song.service.test.ts` — `create`/`update` translate
  `alternateVerseChords` → `alternateVerseDegrees` (and null when absent).
- `apps/backend/src/app.test.ts` — the `/api/songs/:id/suggestions` response now
  carries `score` + `bestMatch` + `matches`; create/update accept
  `alternateVerseChords`. Add a happy-path + a 4xx where relevant.
- `pnpm --filter @medleys/backend test` and
  `pnpm --filter @medleys/backend run typecheck` both green.

---

## Definition of done

- `pnpm --filter @medleys/shared test` green.
- `pnpm --filter @medleys/backend test` and `run typecheck` green.
- New optional `alternateVerse` section persists end-to-end and is matchable.
- Suggestions return `{ song, score, bestMatch, matches }` with `bestMatch`
  identifying the winning section pair.
- Matching rules live in one editable array (`ACTIVE_MATCH_RULES`).

## Coordination with Spec 2 (Frontend)

The reshaped `Suggestion` and the new `Song.alternateVerseDegrees` /
`CreateSongInput.alternateVerseChords` are the shared contract the frontend
consumes. **This spec must land the `packages/shared` changes first** (or on a
shared branch) so the frontend can typecheck/build against the new types. The
type definitions in Part A1 are reproduced verbatim in Spec 2 so both agents
implement the identical contract.
