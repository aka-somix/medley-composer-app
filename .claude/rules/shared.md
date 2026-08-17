# Shared package rules (`packages/shared`)

`@medleys/shared` is the single source of truth for domain types and music
theory, imported by both apps. Treat it as a pure library.

## Purity
- No I/O, no framework imports, no environment access. Every export is a pure
  function or a type. This is what lets backend and frontend both depend on it.
- Music theory is built on `tonal`, wrapped behind our own functions
  (`chordToDegree`, `degreeToChord`, `chordsToDegrees`, `degreesToChords`,
  `progressionSimilarity`). Callers use our API, never `tonal` directly.

## Invariants
- **Degree token format:** `[accidentals][single digit 1-7][quality suffix]`,
  e.g. `2m`, `4M7`, `b3`, `47`. The degree number is always one digit, which is
  what makes the suffix boundary unambiguous — preserve this.
- Chord quality suffixes are opaque and preserved verbatim; only the root moves.
- Scales are major-key roots. `chordsToDegrees`/`degreesToChords` must round-trip
  for diatonic input in the same key.
- Similarity is normalized Levenshtein over token arrays, in `[0,1]`; two empty
  progressions are identical (1).

## Testing
- 100% of exported behavior is unit-tested, including both spec examples
  (`C,G,Dm,FM7` in C → `1,5,2m,4M7`; `1,2m,47` in G → `G,Am,C7`), accidentals,
  every quality suffix used elsewhere, and the round-trip property.
- Any change to the token format or similarity metric requires updating tests in
  the same commit. `pnpm --filter @medleys/shared test` must be green.

## Exports
- Re-export everything from `src/index.ts`. Add new types here, not in the apps,
  when they cross the client/server boundary.
