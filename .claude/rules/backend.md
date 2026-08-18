# Backend rules (`apps/backend`)

Standards for the Express + Drizzle REST API. Follow these without being asked.

## Architecture: layered, dependency-injected
- **Flow:** route → controller → service → repository → Drizzle/DB. Never skip a
  layer (no DB access in controllers, no HTTP objects in services).
- **Controllers** (`controllers/*.controller.ts`) are classes. Methods are thin:
  validate input with a zod schema, call a service, shape the response. No
  business logic, no persistence.
- **Services** (`services/*.service.ts`) hold business logic. They depend on
  repository **interfaces**, never on Drizzle or `better-sqlite3` directly.
- **Repositories**: define the interface in `repositories/<name>.repository.ts`
  and the concrete Drizzle version in `drizzle-<name>.repository.ts`. Swapping the
  database means adding a new implementation — nothing above changes.
- **Composition root** is `container.ts`. All wiring happens there. Inject
  side-effects (id generation, clock) so services stay deterministic in tests.
- `app.ts` is a factory `createApp(container)`; `server.ts` only boots it. Keep
  them separate so tests drive the app in-process with supertest.

## REST conventions
- Base path `/api/songs`. Use proper verbs and status codes: 200 read, 201
  create, 204 delete, 400 validation, 404 missing.
- Register specific routes before parameterized ones (`/search` before `/:id`).
- All request input passes through a zod schema in `validation.ts`. Never trust
  `req.body`/`req.query` shape.
- Throw typed errors (`HttpError`, `NotFoundError`, or a shared music error);
  the central `errorMiddleware` maps them to responses. Wrap async handlers in
  `asyncHandler`.

## Data
- Chord progressions are stored as canonical **scale-degree token arrays**
  (JSON), never raw chords. Translate on write using `@medleys/shared`. `scale`
  is kept for ranking only.
- Ids are app-generated strings (uuid) so storage stays DB-agnostic.

## Music + compatibility
- Never re-implement chord/degree math or similarity here — import from
  `@medleys/shared`. Compatibility threshold is `COMPATIBILITY_THRESHOLD`.
- Suggestion ranking order is fixed: BPM proximity → same scale → same language.
  Ranking only sorts; every song passing the threshold is returned.

## Testing (TDD)
- Write the test first. Service tests use an in-memory container
  (`createContainer({ generateId, now })`). Endpoint tests use `supertest`
  against `createApp`. Every new endpoint gets a happy-path + a 4xx test.
- `pnpm --filter @medleys/backend test` and
  `pnpm --filter @medleys/backend run typecheck` must both be green before you
  consider work done.

## Style
- ESM everywhere; import local files with the `.js` extension. `strict` TS, no
  `any`. Small, single-purpose files.

## Rules
- Treat medleys.sqlite as a production DB. Don't delete it or change its schema without a migration.
