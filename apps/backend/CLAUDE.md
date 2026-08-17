# apps/backend

Express + Drizzle REST API for the Medleys app.

**Before changing anything in this directory, follow the backend standards in
[`.claude/rules/backend.md`](../../.claude/rules/backend.md)** (layered DI
architecture, class controllers, repository interfaces, REST conventions, TDD).
Music/compatibility logic lives in `@medleys/shared` — never re-implement it here.

Quick commands (run from repo root):
- `pnpm --filter @medleys/backend run dev` — start with watch (default port 4000)
- `pnpm --filter @medleys/backend run seed` — load the sample library
- `pnpm --filter @medleys/backend test` — service + supertest suites
