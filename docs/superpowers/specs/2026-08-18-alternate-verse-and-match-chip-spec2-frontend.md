# Spec 2 — Frontend: Alternate verse input & matching-part chip

**Date:** 2026-08-18
**Owns:** `apps/frontend`
**Sibling spec:** Spec 1 (Shared + Backend) —
`2026-08-18-alternate-verse-and-match-chip-spec1-shared-backend.md`

## ⚠️ Dependency / coordination

This spec consumes types owned by Spec 1 in `@medleys/shared`. **Spec 1's
`packages/shared` changes must be present on your branch before this can
typecheck/build.** The exact shared contract is reproduced below so you can code
against it; do not redefine these types in the frontend — import them from
`@medleys/shared`.

```ts
export type SongSection = "verse" | "chorus" | "bridge" | "alternateVerse";
export interface SectionMatch { source: SongSection; target: SongSection; similarity: number; }

export interface Song {
  // ...existing fields...
  verseDegrees: DegreeProgression;
  chorusDegrees: DegreeProgression;
  bridgeDegrees: DegreeProgression | null;
  alternateVerseDegrees: DegreeProgression | null; // NEW
  createdAt: string;
}
export interface CreateSongInput {
  // ...existing fields...
  verseChords: string;
  chorusChords: string;
  bridgeChords?: string | null;
  alternateVerseChords?: string | null; // NEW, optional
}
export interface Suggestion {
  song: Song;
  score: number;           // percentage source
  bestMatch: SectionMatch; // ← drives the chip
  matches: SectionMatch[];
}
```

## Goal

1. Let users enter an **optional** "Alt Verse" chord progression when
   creating/editing a song.
2. Display the alternate verse alongside the other sections in the medley chain.
3. On each suggestion result, show a **chip naming the section of the suggested
   song that matched** (`bestMatch.target`), next to the existing score %.

Follow `.claude/rules/frontend.md` (atomic design; all network via
`api/client.ts` + TanStack hooks; Tailwind vinyl palette only — no raw hex;
`font-mono` for chords; responsive + a11y; TDD with RTL + Vitest; ESM `.js`
imports; no `any`). Never re-implement chord math — transpose for display via
`transpose()` in `lib/scales.ts`.

## No client/hook signature changes needed

`api/client.ts` (`createSong`/`updateSong` take `CreateSongInput`;
`getSuggestions` returns `Suggestion[]`) and `api/hooks.ts` are typed through
`@medleys/shared`, so they pick up the new fields automatically once Spec 1's
types are present. No edits required there beyond confirming they typecheck.

---

## Changes

### 1. `SongForm` (`components/organisms/SongForm.tsx`)

- Add an **optional** "Alt Verse" chord input, mirroring the existing optional
  **Bridge** field in every respect:
  - Add `alternateVerseChords` to the form `EMPTY` default (empty string).
  - In `songToForm`, prefill from `song.alternateVerseDegrees` by transposing
    back to the song's own scale and joining with `", "` (same as bridge).
  - Render via `FormField` with a proper label/`htmlFor` ("Alt Verse"),
    `font-mono` input, placed after the Bridge field.
  - On submit, normalize empty → `null` (same as bridge) and include
    `alternateVerseChords` in the `CreateSongInput` payload.

### 2. `SongNode` (`components/organisms/SongNode.tsx`)

- Render an "Alt Verse" `ChordRow` when `song.alternateVerseDegrees` is present
  (non-null), transposed to `displayScale` via
  `transpose(song.alternateVerseDegrees, displayScale)` — same pattern as the
  Bridge row. Order: Verse, Chorus, Alt Verse, Bridge (or keep Bridge last —
  match existing visual grouping).

### 3. Matching chip (`components/organisms/SuggestionPicker.tsx`)

- For each suggestion, next to the existing score `Tag` (mustard %), render a
  second `Tag` (atom) whose text is the **label for `s.bestMatch.target`**:

  | `bestMatch.target` | label      |
  |--------------------|------------|
  | `verse`            | `Verse`    |
  | `chorus`           | `Chorus`   |
  | `alternateVerse`   | `Alt Verse`|
  | `bridge`           | `Bridge`   |

  Use a distinct palette tone from the score tag (score is `mustard`; pick e.g.
  `teal` or `sepia` from the config palette — no raw hex).
- Accessibility: the chip must have an accessible name that conveys meaning, e.g.
  `aria-label={`Matched on ${label}`}` (or visible helper text). Don't rely on
  color alone.
- Keep a small label→section map local to the component (or a tiny helper). The
  structured `source`/`target` are available for future "Verse → Chorus" style
  rendering, but for V1 render only `bestMatch.target`'s label.
- Remove any reliance on the old `verseSimilarity`/`chorusSimilarity` fields
  (they no longer exist).

### 4. Anything else referencing old `Suggestion` fields

Grep `apps/frontend` for `verseSimilarity` / `chorusSimilarity` and update to the
new shape. `SongCard` needs no change (it shows no progression/suggestion data).

---

## Tests (TDD — write/adjust first)

RTL + Vitest via `renderWithProviders` (`test/utils.tsx`); mock the network with
`vi.spyOn(globalThis, "fetch", …)`; assert through roles/labels.

- `components/organisms/SongForm.test.tsx` — add cases: the Alt Verse field
  renders and is optional; entered chords are submitted as
  `alternateVerseChords`; empty Alt Verse normalizes to `null`; edit prefill
  shows the stored alternate verse transposed to the song's scale.
- `components/organisms/MedleyChain.test.tsx` (where `SuggestionPicker` is
  exercised) — with a mocked `Suggestion` whose `bestMatch.target` is `chorus`,
  the result shows a "Chorus" chip; with `alternateVerse`, an "Alt Verse" chip.
  Also assert a `SongNode` renders the Alt Verse chord row when present.
- Update any existing mocks that build `Suggestion` objects to the new
  `{ song, score, bestMatch, matches }` shape.
- `pnpm --filter @medleys/frontend test`, `run typecheck`, and `run build` all
  green.

## Definition of done

- Users can add/edit an optional Alt Verse progression; it round-trips through
  the form.
- The medley chain shows the Alt Verse row when present.
- Each suggestion shows a chip naming the suggested song's matched section next
  to the score %, accessible and palette-compliant.
- Frontend test, typecheck, and build green.
