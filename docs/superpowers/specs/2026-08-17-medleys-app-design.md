# Medleys App — Design Spec

**Date:** 2026-08-17
**Status:** Implemented (MVP)

## Purpose

A tool for building medleys (chained songs). The user picks a song and the app
suggests other songs that connect well, so they can be chained into a set. Two
songs connect when their chord progressions are close — compared **degree-wise,
verse-to-verse and chorus-to-chorus** — with BPM, music scale, and language as
ranking signals.

Chords are entered per song in that song's key and normalized internally to
**scale-degree progressions**, so all comparison and transposition is
key-independent.

## Key decisions

- **Degree-based internal state.** On write, chords are translated from the song's
  scale into degree tokens (e.g. `C,G,Dm,FM7` in C → `1,5,2m,4M7`). Storage,
  comparison, and display transposition all operate on degrees.
- **Similarity = sequence alignment.** Normalized Levenshtein over degree-token
  arrays: `sim = 1 - levenshtein(a,b) / max(len(a), len(b))`. A candidate is
  compatible when `max(verseSim, chorusSim) ≥ 0.70` (verse-vs-verse,
  chorus-vs-chorus only).
- **Ranking (sort only, never filters):** BPM proximity (highest priority) → same
  music scale → same language (lowest priority). Every song passing the threshold
  is returned.
- **Language** is stored on the song and used only as the lowest-priority ranking
  tiebreaker.
- **Medley chain is ephemeral** — it lives in the Chain page's React state; there
  is no medley entity or endpoint.
- **Music theory via `@tonaljs/tonal`**, wrapped in `@medleys/shared` so it is
  swappable and fully unit-tested.
- **Scales are major-key roots.** Chord quality suffixes (`m`, `7`, `M7`, `sus4`,
  …) are preserved verbatim; non-diatonic roots get accidental-prefixed degrees
  (e.g. `b3`, `#4`). Minor-key entry is out of MVP scope.
- **Title search** is a case-insensitive contains-match behind the repository
  interface (swappable for Postgres full-text search later).

## Architecture

Monorepo (pnpm workspaces):

- **`packages/shared`** — pure types + music theory (`chordsToDegrees`,
  `degreesToChords`, `progressionSimilarity`) + the `COMPATIBILITY_THRESHOLD`.
  Imported by both apps.
- **`apps/backend`** — Express REST API. Layered and dependency-injected:
  route → controller (class) → service → repository interface → Drizzle/SQLite.
  `container.ts` is the composition root; swapping SQLite for Postgres means one
  new repository implementation. `better-sqlite3` for local dev.
- **`apps/frontend`** — React + Vite + Tailwind. Atomic design
  (atoms/molecules/organisms/pages), TanStack Query data layer, React Router,
  vintage "vinyl" palette, responsive.

### Data model — `songs`

`id, title, artist, bpm, scale (original key), language, verseDegrees (JSON),
chorusDegrees (JSON), bridgeDegrees (JSON | null), createdAt`. Progressions are
stored as degree-token arrays.

### REST API

- `GET /api/songs?page=&pageSize=` — paginated list
- `GET /api/songs/search?q=` — title contains-search
- `POST /api/songs` — validate + translate chords → degrees + persist
- `GET /api/songs/:id` — single
- `GET /api/songs/:id/suggestions` — compatible songs, filtered (≥70%) and ranked
- `PUT`/`DELETE /api/songs/:id` — CRUD completeness

### Frontend pages

- **Search** — title full-text search → result cards → open a chain.
- **Library** — paginated list + add-song form (submits raw chords; server
  translates).
- **Chain** — opens on the selected song as the first node in a horizontal chain.
  A page-level scale selector transposes every node's chords. Each node shows
  `Title | Artist`, Verse / Chorus / Bridge chords. A trailing `+` edge opens the
  suggestion list for the last node; picking a song appends a node. Ephemeral.

## Testing

- `shared`: chord/degree translation (both spec examples, accidentals, quality
  suffixes, round-trip property) and similarity (identical/disjoint/threshold).
- `backend`: service tests (translate-on-create, suggestion filter + ranking incl.
  verse-only / chorus-only / tiebreaks) and supertest endpoint tests against an
  in-memory container.
- `frontend`: Testing Library tests for scale transposition, AddSongForm submit,
  and MedleyChain append.

## AI management

- `.claude/rules/{backend,frontend,shared}.md` — opinionated, path-scoped
  standards.
- `apps/*/CLAUDE.md` and `packages/shared/CLAUDE.md` re-reference those rules so
  they auto-load when working in each subtree.

## Out of scope (future)

Saved/named medleys, minor-key entry, Postgres migration, auth/multi-user,
deploying online.
