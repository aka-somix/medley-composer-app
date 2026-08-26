# Tiny Medleys

A tool for building medleys — pick a song, and get suggestions for songs that
chain well by chord progression, then extend the chain node by node.

Two songs connect when their chord progressions are close (compared degree-wise,
verse-to-verse and chorus-to-chorus, ≥70% similar). Matches are ranked by BPM
proximity, then same scale, then same language. Chords are stored internally as
key-independent scale-degree progressions and transposed to any display scale.

## Stack

TypeScript monorepo (pnpm workspaces):

- **`packages/shared`** — pure domain types + music theory (built on `tonal`) +
  progression similarity.
- **`apps/backend`** — Express REST API, Drizzle ORM over SQLite (swappable via
  dependency injection), class-based controllers.
- **`apps/frontend`** — React + Vite + Tailwind (atomic design, vinyl palette,
  TanStack Query, React Router).

## Getting started

Requires [pnpm](https://pnpm.io) (v10+). The repo pins it via `packageManager`,
so `corepack enable` will provision the right version automatically.

```bash
pnpm install

# 1. Seed the sample song library (creates apps/backend/medleys.sqlite)
pnpm run seed

# 2. Start the API (http://localhost:4000)
pnpm run dev:backend

# 3. In another terminal, start the web app (http://localhost:5173)
pnpm run dev:frontend
```

The frontend reads the API base URL from `VITE_API_URL` (defaults to
`http://localhost:4000`).

## Scripts

- `pnpm test` — run every workspace's test suite (`pnpm -r run test`)
- `pnpm run build` — build all workspaces
- `pnpm run seed` — reset + load the sample library

## Authentication

Writes (create/edit/delete/import) require an invited Google account; reads are
public. Auth uses Google Sign-In — the browser gets a Google ID token (a JWT)
that the backend verifies and checks against the `invited_emails` table.

### One-time Google setup

1. In the Google Cloud Console, create an **OAuth 2.0 Client ID** of type **Web
   application**.
2. Under **Authorized JavaScript origins**, add `http://localhost:5173` and your
   deployed frontend URL.
3. Set the client id in both places (same value):
   - backend env `GOOGLE_CLIENT_ID`
   - frontend build env `VITE_GOOGLE_CLIENT_ID`

Google Sign-In and token verification are free at this scale.

### Inviting someone

Insert their email (lowercased) into the `invited_emails` table:

```bash
turso db shell medleys \
  "INSERT INTO invited_emails (email, created_at) VALUES ('friend@gmail.com', datetime('now'))"
```

For a local file DB, run the same `INSERT` via any SQLite client against
`apps/backend/medleys.db`. To revoke, `DELETE` the row.

## Testing

- `pnpm --filter @medleys/shared test` — music theory + similarity
- `pnpm --filter @medleys/backend test` — services + REST endpoints (supertest)
- `pnpm --filter @medleys/frontend test` — components (Vitest + Testing Library)

## Design & conventions

- Design spec: [`docs/superpowers/specs/2026-08-17-medleys-app-design.md`](docs/superpowers/specs/2026-08-17-medleys-app-design.md)
- Coding standards (auto-loaded per subtree): [`.claude/rules/`](.claude/rules/)

## Deploying later

Both apps are local for now but built to host online: the backend is a standard
Express app (point `DB_LOCATION` at a persistent path, or swap the repository
implementation in `apps/backend/src/container.ts` for Postgres), and the frontend
is a static Vite build (`pnpm --filter @medleys/frontend run build`).
