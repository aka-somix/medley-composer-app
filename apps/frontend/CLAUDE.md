# apps/frontend

React + Vite + Tailwind client for the Medleys app.

**Before changing anything in this directory, follow the frontend standards in
[`.claude/rules/frontend.md`](../../.claude/rules/frontend.md)** (atomic design,
TanStack Query data layer, the vinyl Tailwind palette, responsive + a11y rules,
TDD with React Testing Library). Transpose chords via `lib/scales.ts`, which wraps
`@medleys/shared` — never re-implement chord math here.

Quick commands (run from repo root):
- `pnpm --filter @medleys/frontend run dev` — Vite dev server on port 5173
- `pnpm --filter @medleys/frontend test` — Vitest + Testing Library
- `pnpm --filter @medleys/frontend run build` — typecheck + production build

The API base URL comes from `VITE_API_URL` (defaults to `http://localhost:4000`).
