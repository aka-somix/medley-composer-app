# Alternate Verse & Matching Chip — Plan 2 (Frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users enter an optional "Alt Verse" progression, show it in the medley chain, and put a chip on each suggestion naming the suggested song's matched section.

**Architecture:** React + Vite + Tailwind, atomic design. All server access flows through `api/client.ts` + TanStack Query hooks (unchanged — they are typed through `@medleys/shared` and pick up the new fields automatically). Chords are transposed for display via `transpose()` in `lib/scales.ts`.

**Tech Stack:** TypeScript (strict, ESM with `.js` import specifiers), React function components, Tailwind (vinyl palette), Vitest + React Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-18-alternate-verse-and-match-chip-spec2-frontend.md`

## ⚠️ Dependency

This plan imports types owned by **Plan 1** in `@medleys/shared`:
`Song.alternateVerseDegrees`, `CreateSongInput.alternateVerseChords`, the reshaped
`Suggestion { song, score, bestMatch, matches }`, and `SongSection`/`SectionMatch`.
**Plan 1 Task 1 must be on your branch before this plan will typecheck/build.**
Do not redefine these types in the frontend — import them from `@medleys/shared`.

## Global Constraints

- ESM with `.js` import extensions. Strict TS, no `any`. Function components with hooks. (`.claude/rules/frontend.md`)
- Tailwind only; palette tokens from `tailwind.config.js` (`cream`, `parchment`, `dust`, `sepia`, `wax`, `mustard`, `amber`, `rust`, `teal`). No raw hex in components. Chords use `font-mono`. (`.claude/rules/frontend.md`)
- Never call `fetch` directly; go through `api/client.ts` hooks. Never re-implement chord math — use `transpose()`. (`.claude/rules/frontend.md`)
- Every interactive control has an accessible name; don't rely on color alone. (`.claude/rules/frontend.md`)
- Tests: render via `renderWithProviders` (`test/utils.tsx`); mock the network with `vi.spyOn(globalThis, "fetch", …)`; assert through roles/labels.
- Section-to-label map (single source of truth for chip text): `verse → "Verse"`, `chorus → "Chorus"`, `bridge → "Bridge"`, `alternateVerse → "Alt Verse"`.

---

### Task 1: Alt Verse input in `SongForm`

**Files:**
- Modify: `apps/frontend/src/components/organisms/SongForm.tsx`
- Test: `apps/frontend/src/components/organisms/SongForm.test.tsx`

**Interfaces:**
- Consumes: `CreateSongInput.alternateVerseChords`, `Song.alternateVerseDegrees` (`@medleys/shared`); `transpose` (`lib/scales.ts`); `FormField`, `Input` (existing).
- Produces: the form collects/prefills `alternateVerseChords`, submitting it in the `CreateSongInput` payload (empty → `null`).

- [ ] **Step 1: Update the test fixture and add failing assertions**

In `apps/frontend/src/components/organisms/SongForm.test.tsx`:

(a) Add the new required field to the `SONG` fixture (after `bridgeDegrees: null,`):

```ts
  bridgeDegrees: null,
  alternateVerseDegrees: null,
```

(b) In the "submits raw chords and normalizes an empty bridge to null" test, extend the `toMatchObject` to also expect the alternate verse normalized to null:

```ts
    expect(body).toMatchObject({
      title: "Cream Sky",
      artist: "The Grooves",
      verseChords: "C, G, Am, F",
      chorusChords: "F, C, G, Am",
      bridgeChords: null,
      alternateVerseChords: null,
    });
```

(c) In the "pre-fills from a song and saves changes with PUT" test, after the Bridge assertion, add:

```ts
    expect(screen.getByLabelText("Alt Verse chords (optional)")).toHaveValue("");
```

(d) Add a new test after the existing two:

```ts
  it("submits an alternate verse when provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "new" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SongForm />);

    await user.type(screen.getByLabelText("Title"), "Alt Song");
    await user.type(screen.getByLabelText("Artist"), "A");
    await user.type(screen.getByLabelText("Verse chords"), "C, G, Am, F");
    await user.type(screen.getByLabelText("Chorus chords"), "F, C, G, Am");
    await user.type(screen.getByLabelText("Alt Verse chords (optional)"), "Am, F, C, G");
    await user.click(screen.getByRole("button", { name: /add song/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.alternateVerseChords).toBe("Am, F, C, G");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/SongForm.test.tsx`
Expected: FAIL — no "Alt Verse chords (optional)" field; `alternateVerseChords` absent from the body.

- [ ] **Step 3: Add `alternateVerseChords` to the form defaults and prefill**

In `apps/frontend/src/components/organisms/SongForm.tsx`, add to `EMPTY` (after `bridgeChords: ""`):

```ts
  bridgeChords: "",
  alternateVerseChords: "",
```

Add to `songToForm`'s return (after the `bridgeChords` line):

```ts
    bridgeChords: transpose(song.bridgeDegrees, song.scale).join(", "),
    alternateVerseChords: transpose(song.alternateVerseDegrees, song.scale).join(", "),
```

- [ ] **Step 4: Normalize empty alternate verse to null on submit**

Replace the `handleSubmit` `body` line with:

```ts
    const body = {
      ...form,
      bridgeChords: form.bridgeChords?.trim() ? form.bridgeChords : null,
      alternateVerseChords: form.alternateVerseChords?.trim() ? form.alternateVerseChords : null,
    };
```

- [ ] **Step 5: Render the Alt Verse field**

After the Bridge `FormField` block (closes on the line with `</FormField>` after the bridge `Input`), add:

```tsx
      <FormField label="Alt Verse chords (optional)" htmlFor="altVerse">
        <Input
          id="altVerse"
          value={form.alternateVerseChords ?? ""}
          onChange={(e) => set("alternateVerseChords", e.target.value)}
        />
      </FormField>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/SongForm.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/organisms/SongForm.tsx apps/frontend/src/components/organisms/SongForm.test.tsx
git commit -m "feat(frontend): optional alternate verse input in SongForm"
```

---

### Task 2: Show the alternate verse row in `SongNode`

**Files:**
- Modify: `apps/frontend/src/components/organisms/SongNode.tsx`
- Test: `apps/frontend/src/components/organisms/MedleyChain.test.tsx`

**Interfaces:**
- Consumes: `Song.alternateVerseDegrees`; `transpose` (`lib/scales.ts`); `ChordRow` (existing).
- Produces: `SongNode` renders an "Alt Verse" `ChordRow` when `song.alternateVerseDegrees` is non-null.

- [ ] **Step 1: Update the shared test `song()` helper and add a failing test**

In `apps/frontend/src/components/organisms/MedleyChain.test.tsx`:

(a) Add the new required field to the `song()` helper defaults (after `bridgeDegrees: null,`):

```ts
    bridgeDegrees: null,
    alternateVerseDegrees: null,
```

(b) Add a new test inside `describe("MedleyChain", …)`:

```ts
  it("renders an alternate verse row when the song has one", () => {
    renderWithProviders(
      <MedleyChain
        chain={[song({ alternateVerseDegrees: ["6m", "4", "1", "5"] })]}
        displayScale="C"
        onAppend={() => {}}
      />,
    );
    expect(screen.getByText("Alt Verse")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/MedleyChain.test.tsx`
Expected: FAIL — no "Alt Verse" text (row not rendered).

- [ ] **Step 3: Render the alternate verse row**

In `apps/frontend/src/components/organisms/SongNode.tsx`, replace the chord rows block (the `<div className="flex flex-col gap-2 border-t border-dust/60 pt-3">` contents) with:

```tsx
      <div className="flex flex-col gap-2 border-t border-dust/60 pt-3">
        <ChordRow label="Verse" chords={transpose(song.verseDegrees, displayScale)} />
        <ChordRow label="Chorus" chords={transpose(song.chorusDegrees, displayScale)} />
        {song.alternateVerseDegrees ? (
          <ChordRow label="Alt Verse" chords={transpose(song.alternateVerseDegrees, displayScale)} />
        ) : null}
        <ChordRow label="Bridge" chords={transpose(song.bridgeDegrees, displayScale)} />
      </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/MedleyChain.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/organisms/SongNode.tsx apps/frontend/src/components/organisms/MedleyChain.test.tsx
git commit -m "feat(frontend): show alternate verse row in the medley chain"
```

---

### Task 3: Matching-part chip in `SuggestionPicker`

**Files:**
- Modify: `apps/frontend/src/components/organisms/SuggestionPicker.tsx`
- Test: `apps/frontend/src/components/organisms/MedleyChain.test.tsx`

**Interfaces:**
- Consumes: reshaped `Suggestion` (`s.bestMatch.target`, `s.score`), `SongSection` (`@medleys/shared`); `Tag` atom (`tone` = `neutral` | `teal` | `mustard`).
- Produces: each suggestion result shows a section chip (accessible name "Matched on <label>") beside the score %.

- [ ] **Step 1: Update the existing suggestion object and add a failing chip test**

In `apps/frontend/src/components/organisms/MedleyChain.test.tsx`:

(a) Replace the `suggestion` object in the "appends a picked suggestion" test with the new shape:

```ts
    const suggestion: Suggestion = {
      song: next,
      score: 1,
      bestMatch: { source: "verse", target: "verse", similarity: 1 },
      matches: [{ source: "verse", target: "verse", similarity: 1 }],
    };
```

(b) Add a new test:

```ts
  it("shows a chip naming the suggested song's matched section", async () => {
    const next = song({ id: "s2", title: "Alt Match" });
    const suggestion: Suggestion = {
      song: next,
      score: 0.9,
      bestMatch: { source: "verse", target: "alternateVerse", similarity: 0.9 },
      matches: [{ source: "verse", target: "alternateVerse", similarity: 0.9 }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([suggestion]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<MedleyChain chain={[song({})]} displayScale="C" onAppend={() => {}} />);

    await user.click(screen.getByLabelText("Find a compatible next song"));
    await screen.findByRole("button", { name: /Alt Match/ });
    // "Alt Verse" appears only in the suggestion chip here (the chain song has no alt verse row).
    expect(screen.getByText("Alt Verse")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/MedleyChain.test.tsx`
Expected: FAIL — no "Alt Verse" chip rendered.

- [ ] **Step 3: Add the label map and render the chip**

In `apps/frontend/src/components/organisms/SuggestionPicker.tsx`:

(a) Extend the shared import to bring in the section type:

```ts
import type { Song, SongSection } from "@medleys/shared";
```

(b) Add the label map above the component (after the imports):

```ts
/** Chip text for the section of the suggested song that matched. */
const SECTION_LABEL: Record<SongSection, string> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  alternateVerse: "Alt Verse",
};
```

(c) Replace the score row (the `<div className="flex items-center justify-between gap-2">` block containing the title and the single score `Tag`) with:

```tsx
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{s.song.title}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="sr-only">Matched on </span>
                      <Tag tone="neutral">{SECTION_LABEL[s.bestMatch.target]}</Tag>
                      <Tag tone="mustard">{Math.round(s.score * 100)}%</Tag>
                    </div>
                  </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/MedleyChain.test.tsx`
Expected: PASS (both the appends test and the new chip test).

- [ ] **Step 5: Run the full frontend gate**

Run: `pnpm --filter @medleys/frontend test`
Expected: PASS (all suites).
Run: `pnpm --filter @medleys/frontend run typecheck`
Expected: PASS (reshaped `Suggestion` / new `Song` fields resolve against `@medleys/shared`).
Run: `pnpm --filter @medleys/frontend run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/organisms/SuggestionPicker.tsx apps/frontend/src/components/organisms/MedleyChain.test.tsx
git commit -m "feat(frontend): matching-part chip on suggestion results"
```

---

## Self-review notes

- **Spec coverage:** §1 SongForm alt verse → Task 1; §2 SongNode row → Task 2; §3 chip → Task 3; §4 stray old-field references → Task 3 Step 1 (updates the only two `Suggestion` literals, in `MedleyChain.test.tsx`; grep confirmed no other frontend file constructs a `Suggestion`). Client/hooks "no signature change" → verified: `api/client.ts` and `api/hooks.ts` are typed through `@medleys/shared` and need no edits; the type gate in Task 3 Step 5 covers them.
- **Accessibility:** chip carries a visible label plus an `sr-only` "Matched on " prefix, so meaning is not color-dependent.
- **Palette:** chip uses `Tag tone="neutral"` (distinct from the `mustard` score tag); no raw hex introduced.
- **Type consistency:** `SECTION_LABEL` keys are the full `SongSection` union; `s.bestMatch.target` typed as `SongSection`; `Suggestion` literals match `{ song, score, bestMatch, matches }` from Plan 1 Task 1.

## Coordination with Plan 1

Requires Plan 1 Task 1 (shared types) on the branch. If Plan 1 and Plan 2 run on separate branches, rebase Plan 2 onto Plan 1's shared changes before running the Task 3 Step 5 typecheck/build gate.
