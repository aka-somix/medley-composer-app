# Frontend rules (`apps/frontend`)

Standards for the React + Vite + Tailwind client. Follow these without being asked.

## Atomic design
- Components live under `components/{atoms,molecules,organisms}` and pages under
  `pages/`.
  - **Atoms** — one element, no app knowledge (Button, Input, Select, ChordBadge,
    Tag, Spinner).
  - **Molecules** — small compositions of atoms (ChordRow, ScaleSelector,
    SongCard, FormField, Pagination).
  - **Organisms** — feature blocks that may fetch data (AddSongForm,
    MedleyChain, SuggestionPicker, NavBar).
  - **Pages** — route-level composition + local state.
- Build the smallest reusable piece first; don't inline markup a molecule already
  covers. A component that needs the network is an organism, not a molecule.

## Data fetching
- All server access goes through `api/client.ts` (typed with `@medleys/shared`
  types) wrapped in TanStack Query hooks in `api/hooks.ts`. Components never call
  `fetch` directly.
- Query keys start with `["songs", …]`. Mutations invalidate `["songs"]`.

## Music
- Never re-implement chord math. Transpose degree progressions for display with
  `transpose()` in `lib/scales.ts` (which wraps `@medleys/shared`). The API
  returns degree tokens; the UI chooses the display scale.

## Styling — vintage vinyl
- Tailwind only; use the palette tokens from `tailwind.config.js` (`cream`,
  `parchment`, `dust`, `sepia`, `wax`, `mustard`, `amber`, `rust`, `teal`). No raw
  hex values in components.
- Headings `font-display`, chords `font-mono`. Keep the UI minimal and warm.
- **Responsive is required**: design mobile-first, verify at tablet and mobile
  widths. Wide content (the medley chain) scrolls horizontally inside its own
  container — the page body never scrolls sideways.

## Accessibility
- Every interactive control has an accessible name (label, `aria-label`, or text).
  Inputs are tied to labels via `htmlFor`/`id` (use `FormField`). Loading and
  error states are announced.

## Testing (TDD)
- React Testing Library + Vitest (jsdom). Render via `test/utils.tsx`
  (`renderWithProviders`). Test behavior through the accessible UI (roles,
  labels), mock the network with `vi.spyOn(globalThis, "fetch", …)`.
- `pnpm --filter @medleys/frontend test`, `run typecheck`, and `run build` must
  be green.

## Style
- ESM with `.js` import extensions. Strict TS, no `any`. Function components with
  hooks; no class components.
