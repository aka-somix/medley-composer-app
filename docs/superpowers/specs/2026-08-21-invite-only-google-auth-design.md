# Invite-only Google auth — design

**Date:** 2026-08-21
**Status:** Approved for planning

## Goal

Make the Medleys app writable only by an invite-only set of people, while
everyone else keeps full read-only access.

- **Anonymous users:** browse, search, view chains and suggestions (unchanged).
- **Invited users:** additionally create, edit, delete, and batch-import songs.

Authentication is Google Sign-In only. Google hands the browser a Google **ID
token, which is itself a JWT**; the backend verifies that token directly on each
write request and checks the caller's email against an `invited_emails` table.
There is **no self-registration** — the only way to gain write access is a row in
that table, added manually.

## Non-goals

- No app-issued JWTs, no signing secret, no session store, no refresh-token
  handling. Google's ID token is the credential; when it expires (~1h) the user
  signs in again.
- No self-service invite/registration flow. Adding an invite is a manual SQL
  insert (documented below).
- No roles/permissions beyond the binary invited / not-invited.
- No change to the existing songs domain, ranking, or suggestion logic.

## Decisions (locked during brainstorming)

1. **Verify Google's token directly** rather than issuing an app JWT — no secret,
   no auth endpoint for token issuance, no token storage.
2. **Invited emails live in a new DB table** (`invited_emails`), checked per
   request after the Google token is verified.
3. **Adding an invite is a documented `turso db shell` INSERT** — no new code for
   the invite-management path.
4. **Reads stay public**; only the four mutating routes are protected.

## Architecture

```
Browser (React)
  Google Identity Services  ──►  Google ID token (JWT)
        │  Authorization: Bearer <google-id-token>   (writes only)
        ▼
Express backend
  requireInvited middleware
    1. verify Google ID token (audience = GOOGLE_CLIENT_ID)  ── google-auth-library
    2. require email_verified
    3. InviteRepository.isInvited(email)  ── SELECT from invited_emails
    → 401 on any failure, else req.user = { email } and continue
        ▼
  existing SongsController (unchanged)
```

Reads (`GET` routes) bypass the middleware entirely.

## Backend

### 1. New table

Added to the existing idempotent `ensureSchema()` block in `db/client.ts`
(same mechanism as `songs` — `CREATE TABLE IF NOT EXISTS`, no migration
framework), and to `db/schema.ts` as a Drizzle table:

```sql
CREATE TABLE IF NOT EXISTS invited_emails (
  email      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
```

```ts
// db/schema.ts
export const invitedEmails = sqliteTable("invited_emails", {
  email: text("email").primaryKey(),
  createdAt: text("created_at").notNull(),
});
```

Emails are matched case-insensitively — store and compare lowercased (the
repository lowercases the incoming email before the lookup; documented invites
should be inserted lowercased).

### 2. Invite lookup repository

A small interface matching the existing repository/DI pattern:

```ts
// repositories/invite.repository.ts
export interface InviteRepository {
  isInvited(email: string): Promise<boolean>;
}
```

A Drizzle implementation (`DrizzleInviteRepository`) does a single
`SELECT email FROM invited_emails WHERE email = ?` (lowercased). Wired in the
container next to `DrizzleSongRepository`, and overridable (a fake) for tests.

### 3. Auth middleware

`http/require-invited.ts` exports a factory that takes its dependencies
injected (mirrors how the container injects `generateId` / `now` / `repository`
so tests never hit the network):

```ts
export interface TokenVerifier {
  // returns the verified payload, or throws on any invalid/expired token
  verify(idToken: string): Promise<{ email: string; email_verified: boolean }>;
}

export function requireInvited(deps: {
  verifier: TokenVerifier;
  invites: InviteRepository;
}): RequestHandler;
```

Behaviour:

1. Read `Authorization` header; require `Bearer <token>`, else `401`.
2. `deps.verifier.verify(token)` — throws → `401`. The production verifier wraps
   `google-auth-library`'s `OAuth2Client.verifyIdToken({ idToken, audience:
   GOOGLE_CLIENT_ID })`, which validates signature, expiry, issuer, and audience.
3. Require `payload.email_verified === true`, else `401`.
4. `await deps.invites.isInvited(payload.email)` — false → `401`.
5. Success: set `req.user = { email }` and call `next()`.

All failure modes return `401` with a JSON `{ error }` body via the existing
`errorMiddleware` conventions. (A verified-but-not-invited user is deliberately
`401`, not `403` — we don't distinguish "unknown token" from "known but
uninvited" to callers.)

The production `GoogleTokenVerifier` reads `GOOGLE_CLIENT_ID` from env at
container construction; if it is unset the backend fails fast at startup with a
clear error (so writes can never be accidentally unprotected).

### 4. Route wiring

In `routes/songs.routes.ts`, apply the middleware to the four mutating routes
only:

```
router.post("/batch", requireInvited, asyncHandler(controller.batchImport));
router.post("/",       requireInvited, asyncHandler(controller.create));
router.put("/:id",     requireInvited, asyncHandler(controller.update));
router.delete("/:id",  requireInvited, asyncHandler(controller.remove));
```

`GET` routes (`/`, `/search`, `/:id`, `/:id/suggestions`) are unchanged and
remain public.

The middleware instance is built in the container (it needs `invites` and
`verifier`) and passed into `createSongsRouter` / `createApp`.

### 5. `GET /api/auth/me`

A single authed route guarded by the same `requireInvited` middleware that
returns `{ email }` for an invited caller (and `401` otherwise). Lets the
frontend hide edit controls from users who are signed in but not invited,
instead of showing buttons that would 401. It carries no new logic — just the
middleware plus a one-line handler.

### 6. New dependency & env

- Add `google-auth-library` to `apps/backend`.
- New backend env var `GOOGLE_CLIENT_ID` (documented in `.env` and README).

## Frontend

### 1. Auth hook / context

`api/useAuth.ts` (a small React context provider + hook) loads Google Identity
Services and exposes:

```ts
{ token: string | null; user: { email: string } | null;
  signIn(): void; signOut(): void; }
```

- On sign-in, Google's callback yields the ID token (the `credential`); store it
  in memory and mirror it to `localStorage` so a page refresh stays signed in.
- On sign-out, clear both and revoke the Google session.
- `user` is populated from `GET /api/auth/me` after a token is obtained — so
  `user !== null` means "signed in **and** invited". A signed-in-but-uninvited
  Google account yields `token !== null` but `user === null`.
- Token expiry (~1h) surfaces as a `401` on a write; the client triggers
  `signOut()` and the UI prompts to sign in again.

`VITE_GOOGLE_CLIENT_ID` (build-time) supplies the client ID; it must equal the
backend's `GOOGLE_CLIENT_ID`.

### 2. API client

`api/client.ts`'s existing `request()` wrapper attaches
`Authorization: Bearer <token>` when a token is present (single place, single
line). Reads work with or without it; writes require it.

### 3. NavBar

- **Signed out:** a control labelled **"Got invited?"** that reads **"Sign in"**
  on hover; clicking starts Google sign-in.
- **Signed in (invited):** show the email and a **"Sign out"** action.

### 4. Edit-control gating

Create / edit / delete / import controls (in `SongsPage`, `SongForm`,
`SongImport`, `ConfirmDialog` triggers, chain edit affordances) render only when
`user !== null` (signed in and invited). Everyone else sees the read-only UI.

## One-time setup (to document in README)

1. In Google Cloud Console, create an **OAuth 2.0 Client ID** of type **Web
   application**.
   - **Authorized JavaScript origins:** `http://localhost:5173` and the deployed
     frontend URL.
2. Set the client ID in both places (same value):
   - backend env `GOOGLE_CLIENT_ID`
   - frontend build env `VITE_GOOGLE_CLIENT_ID`
3. Grant someone write access (manual, documented):
   ```bash
   turso db shell medleys \
     "INSERT INTO invited_emails (email, created_at) \
      VALUES ('friend@gmail.com', datetime('now'))"
   ```
   Insert the email **lowercased**.

**Cost:** free. Google Sign-In / OAuth, `google-auth-library`, the extra Turso
table, and Cloudflare Workers static assets are all within existing free usage.

## Error handling

- Any auth failure (missing/malformed header, invalid/expired token, unverified
  email, uninvited email) → `401` JSON `{ error }` via `errorMiddleware`.
- Missing `GOOGLE_CLIENT_ID` at startup → backend throws immediately (fail-safe:
  no client ID means writes cannot be verified, so the server must not boot).
- Frontend: a `401` on a write clears the session and prompts re-sign-in; read
  paths are unaffected.

## Testing

Follows existing conventions (Vitest; backend supertest over `createApp`;
frontend React Testing Library via `renderWithProviders`).

**Backend**
- `requireInvited` unit tests with a **stubbed `TokenVerifier`** and a fake
  `InviteRepository`:
  - no header / non-Bearer → 401
  - verifier throws (invalid/expired) → 401
  - `email_verified === false` → 401
  - verified but `isInvited` false → 401
  - verified and invited → `next()` called, `req.user.email` set
- Supertest over the app:
  - `GET` routes succeed with no auth (read-only preserved)
  - `POST/PUT/DELETE /api/songs...` → 401 without a valid token
  - same routes succeed with an invited stubbed token
  - `GET /api/auth/me` → 401 unauthed, `{ email }` when invited
- `DrizzleInviteRepository.isInvited` against an in-memory db: present (any case)
  → true, absent → false.

**Frontend**
- Edit controls hidden when `user === null`, visible when `user` is set (mock
  `useAuth`).
- `api/client` attaches the `Authorization` header when a token is present and
  omits it otherwise.
- NavBar shows "Got invited?" signed out and the email + "Sign out" signed in.

## Files touched

**Backend**
- `db/schema.ts` — add `invitedEmails` table.
- `db/client.ts` — add `invited_emails` to `ensureSchema`.
- `repositories/invite.repository.ts` — new interface.
- `repositories/drizzle-invite.repository.ts` — new impl.
- `http/require-invited.ts` — new middleware + `GoogleTokenVerifier`.
- `container.ts` — wire verifier, invite repo, middleware; read `GOOGLE_CLIENT_ID`.
- `routes/songs.routes.ts` — guard the four write routes; add `auth/me`.
- `app.ts` — mount `auth/me` (or pass middleware through).
- `.env` / `.env` docs, `package.json` — `google-auth-library`.
- Tests alongside the above.

**Frontend**
- `api/useAuth.ts` — new auth context/hook.
- `api/client.ts` — attach bearer header.
- `components/organisms/NavBar.tsx` — sign-in / sign-out UI.
- `SongsPage.tsx`, `SongForm.tsx`, `SongImport.tsx`, chain edit affordances —
  gate on `user`.
- `main.tsx` — wrap app in the auth provider.
- Tests alongside the above.

**Docs**
- `README.md` — Google Cloud setup, env vars, and the invite SQL command.
