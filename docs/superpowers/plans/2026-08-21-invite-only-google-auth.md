# Invite-only Google Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make song writes (create/update/delete/import) require an invited Google account, while all reads stay public.

**Architecture:** The frontend gets a Google ID token (a JWT) via Google Identity Services and sends it as a Bearer header on writes. An Express middleware verifies the token with `google-auth-library` and checks the email against a new `invited_emails` table. No app-issued JWT, no secret, no token storage. The verifier and invite repository are dependency-injected (like the existing `generateId`/`repository` overrides) so tests never hit Google.

**Tech Stack:** TypeScript, Express, Drizzle + libSQL/Turso, `google-auth-library` (new), React + Vite, Google Identity Services (GIS), TanStack Query, Vitest, supertest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-invite-only-google-auth-design.md`

## Global Constraints

- ESM everywhere with explicit `.js` import extensions. Strict TS, no `any`.
- Backend errors surface as JSON `{ error }` through the existing `errorMiddleware`; all auth failures return **401** (never 403).
- Emails are stored and compared **lowercased**.
- Reads (`GET /api/songs...`) MUST remain public; only `POST /`, `POST /batch`, `PUT /:id`, `DELETE /:id` are guarded.
- `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend) MUST be the same value. Backend fails fast at startup if it is required but unset.
- Follow existing conventions: class-based controllers, repository interfaces + Drizzle impls wired in `container.ts`, atomic-design frontend, all network access through `api/client.ts`, TDD.

---

### Task 1: `invited_emails` table + InviteRepository

**Files:**
- Modify: `apps/backend/src/db/schema.ts`
- Modify: `apps/backend/src/db/client.ts` (the `ensureSchema` SQL block)
- Create: `apps/backend/src/repositories/invite.repository.ts`
- Create: `apps/backend/src/repositories/drizzle-invite.repository.ts`
- Test: `apps/backend/src/repositories/drizzle-invite.repository.test.ts`

**Interfaces:**
- Consumes: `Db` from `db/client.js`, `createDatabase` from `db/client.js`.
- Produces:
  - `invitedEmails` Drizzle table (`db/schema.ts`).
  - `interface InviteRepository { isInvited(email: string): Promise<boolean> }`.
  - `class DrizzleInviteRepository implements InviteRepository { constructor(db: Db) }`.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/repositories/drizzle-invite.repository.test.ts`:

```ts
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { DrizzleInviteRepository } from "./drizzle-invite.repository.js";

let handle: DatabaseHandle;
let repo: DrizzleInviteRepository;

beforeEach(async () => {
  handle = await createDatabase(":memory:");
  repo = new DrizzleInviteRepository(handle.db);
  await handle.raw.execute(
    "INSERT INTO invited_emails (email, created_at) VALUES ('friend@gmail.com', '2026-08-21T00:00:00.000Z')",
  );
});

afterEach(() => handle.close());

describe("DrizzleInviteRepository.isInvited", () => {
  it("returns true for an invited email", async () => {
    expect(await repo.isInvited("friend@gmail.com")).toBe(true);
  });

  it("matches case-insensitively", async () => {
    expect(await repo.isInvited("Friend@Gmail.com")).toBe(true);
  });

  it("returns false for an unknown email", async () => {
    expect(await repo.isInvited("stranger@gmail.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @medleys/backend test drizzle-invite`
Expected: FAIL — cannot import `./drizzle-invite.repository.js` / table `invited_emails` does not exist.

- [ ] **Step 3: Add the table to the schema**

In `apps/backend/src/db/schema.ts`, after the `songs` table, add:

```ts
/** Emails allowed to perform writes. Populated manually (see README). */
export const invitedEmails = sqliteTable("invited_emails", {
  email: text("email").primaryKey(),
  createdAt: text("created_at").notNull(),
});

export type InvitedEmailRow = typeof invitedEmails.$inferSelect;
```

In `apps/backend/src/db/client.ts`, inside the `ensureSchema` `executeMultiple` template (after the `songs` table + index), add:

```sql
    CREATE TABLE IF NOT EXISTS invited_emails (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
```

- [ ] **Step 4: Write the interface**

Create `apps/backend/src/repositories/invite.repository.ts`:

```ts
/**
 * Persistence boundary for the invite allow-list. The auth middleware depends
 * on this interface only, so the check can be faked in tests.
 */
export interface InviteRepository {
  /** True when `email` (compared lowercased) has been invited. */
  isInvited(email: string): Promise<boolean>;
}
```

- [ ] **Step 5: Write the Drizzle implementation**

Create `apps/backend/src/repositories/drizzle-invite.repository.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { invitedEmails } from "../db/schema.js";
import type { InviteRepository } from "./invite.repository.js";

export class DrizzleInviteRepository implements InviteRepository {
  constructor(private readonly db: Db) {}

  async isInvited(email: string): Promise<boolean> {
    const row = await this.db
      .select({ email: invitedEmails.email })
      .from(invitedEmails)
      .where(eq(invitedEmails.email, email.toLowerCase()))
      .get();
    return row !== undefined;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @medleys/backend test drizzle-invite`
Expected: PASS (all three).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/db/schema.ts apps/backend/src/db/client.ts apps/backend/src/repositories/invite.repository.ts apps/backend/src/repositories/drizzle-invite.repository.ts apps/backend/src/repositories/drizzle-invite.repository.test.ts
git commit -m "feat(backend): invited_emails table and InviteRepository"
```

---

### Task 2: `requireInvited` middleware + Google token verifier

**Files:**
- Add dependency: `apps/backend/package.json` → `google-auth-library`
- Create: `apps/backend/src/http/require-invited.ts`
- Test: `apps/backend/src/http/require-invited.test.ts`

**Interfaces:**
- Consumes: `InviteRepository` from `repositories/invite.repository.js`.
- Produces:
  - `interface TokenVerifier { verify(idToken: string): Promise<{ email: string; email_verified: boolean }> }`
  - `function requireInvited(deps: { verifier: TokenVerifier; invites: InviteRepository }): RequestHandler`
  - `class GoogleTokenVerifier implements TokenVerifier { constructor(clientId: string) }`
  - Express `Request.user?: { email: string }` augmentation.

- [ ] **Step 1: Install the dependency**

Run: `pnpm --filter @medleys/backend add google-auth-library`
Expected: `google-auth-library` appears under `dependencies` in `apps/backend/package.json`.

- [ ] **Step 2: Write the failing test**

Create `apps/backend/src/http/require-invited.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { requireInvited, type TokenVerifier } from "./require-invited.js";
import type { InviteRepository } from "../repositories/invite.repository.js";

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const invited: InviteRepository = {
  isInvited: async (email) => email === "friend@gmail.com",
};

function verifier(payload: { email: string; email_verified: boolean }): TokenVerifier {
  return { verify: vi.fn().mockResolvedValue(payload) };
}

function throwingVerifier(): TokenVerifier {
  return { verify: vi.fn().mockRejectedValue(new Error("bad token")) };
}

describe("requireInvited", () => {
  it("401s when the Authorization header is missing", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the header is not a Bearer token", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: { authorization: "Basic abc" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the verifier rejects the token", async () => {
    const mw = requireInvited({ verifier: throwingVerifier(), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the email is not verified", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: false }), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the email is verified but not invited", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "stranger@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets req.user for an invited, verified email", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ email: "friend@gmail.com" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @medleys/backend test require-invited`
Expected: FAIL — cannot import `./require-invited.js`.

- [ ] **Step 4: Write the middleware and verifier**

Create `apps/backend/src/http/require-invited.ts`:

```ts
import type { RequestHandler } from "express";
import { OAuth2Client } from "google-auth-library";
import type { InviteRepository } from "../repositories/invite.repository.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { email: string };
    }
  }
}

/** Verifies a Google ID token and returns the fields we rely on. Throws on any invalid/expired token. */
export interface TokenVerifier {
  verify(idToken: string): Promise<{ email: string; email_verified: boolean }>;
}

/** Production verifier: validates signature, expiry, issuer, and audience via Google. */
export class GoogleTokenVerifier implements TokenVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<{ email: string; email_verified: boolean }> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("token has no email");
    return { email: payload.email, email_verified: payload.email_verified === true };
  }
}

/** Guard for write routes: require a valid Google token whose email is invited. */
export function requireInvited(deps: {
  verifier: TokenVerifier;
  invites: InviteRepository;
}): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const header = req.headers.authorization ?? "";
      const [scheme, token] = header.split(" ");
      if (scheme !== "Bearer" || !token) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      let payload: { email: string; email_verified: boolean };
      try {
        payload = await deps.verifier.verify(token);
      } catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      if (!payload.email_verified || !(await deps.invites.isInvited(payload.email))) {
        res.status(401).json({ error: "Not invited" });
        return;
      }
      req.user = { email: payload.email.toLowerCase() };
      next();
    })();
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @medleys/backend test require-invited`
Expected: PASS (all six).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/package.json apps/backend/src/http/require-invited.ts apps/backend/src/http/require-invited.test.ts pnpm-lock.yaml
git commit -m "feat(backend): requireInvited middleware and Google token verifier"
```

---

### Task 3: Wire auth into the container, routes, and `/api/auth/me`

**Files:**
- Modify: `apps/backend/src/container.ts`
- Modify: `apps/backend/src/routes/songs.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `apps/backend/src/app.test.ts` (existing tests must supply auth for writes)
- Modify: `apps/backend/.env` (document `GOOGLE_CLIENT_ID`)

**Interfaces:**
- Consumes: `requireInvited`, `TokenVerifier`, `GoogleTokenVerifier` (Task 2); `InviteRepository`, `DrizzleInviteRepository` (Task 1).
- Produces (on `Container`): `invites: InviteRepository`, `requireInvited: RequestHandler`. `ContainerConfig` gains `googleClientId?`, `verifier?`, `invites?`. `createSongsRouter(controller, requireInvited)`.

- [ ] **Step 1: Update the failing app tests first**

In `apps/backend/src/app.test.ts`:

Replace the `beforeEach` container construction so it injects a fake verifier and invite list (no network, no DB seeding):

```ts
container = await createContainer({
  generateId: () => `id-${++seq}`,
  now: () => "2026-08-17T00:00:00.000Z",
  verifier: { verify: async () => ({ email: "invited@example.com", email_verified: true }) },
  invites: { isInvited: async (email) => email === "invited@example.com" },
});
```

Add `.set("Authorization", "Bearer test")` to every **write** request in this file (the `POST /api/songs`, `POST /api/songs/batch`, `PUT`, `DELETE` calls). For example the create test becomes:

```ts
const res = await request(app).post("/api/songs").set("Authorization", "Bearer test").send(validBody);
```

Leave all `GET` requests unchanged (no header). Then add two new tests at the end of the file:

```ts
describe("auth on writes", () => {
  it("rejects a write with no token (401)", async () => {
    const res = await request(app).post("/api/songs").send(validBody);
    expect(res.status).toBe(401);
  });

  it("still allows reads without a token", async () => {
    const res = await request(app).get("/api/songs?page=1&pageSize=8");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("401s without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the email for an invited caller", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: "invited@example.com" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @medleys/backend test app.test`
Expected: FAIL — `createContainer` does not accept `verifier`/`invites`; `/api/auth/me` 404s; writes without a token still 201.

- [ ] **Step 3: Extend the container**

In `apps/backend/src/container.ts`:

Add imports:

```ts
import type { RequestHandler } from "express";
import { DrizzleInviteRepository } from "./repositories/drizzle-invite.repository.js";
import type { InviteRepository } from "./repositories/invite.repository.js";
import { GoogleTokenVerifier, requireInvited, type TokenVerifier } from "./http/require-invited.js";
```

Add to `ContainerConfig`:

```ts
  /** Google OAuth client id used to verify ID tokens. Required unless `verifier` is injected. */
  googleClientId?: string;
  /** Inject a token verifier (a fake) instead of the Google one. */
  verifier?: TokenVerifier;
  /** Inject a pre-built invite repository (e.g. a fake) instead of the Drizzle one. */
  invites?: InviteRepository;
```

Add to the `Container` interface:

```ts
  invites: InviteRepository;
  requireInvited: RequestHandler;
```

In `createContainer`, replace the repository-building block so both repos share one database when needed, and build the verifier + middleware:

```ts
  let database: DatabaseHandle | undefined;
  let repository = config.repository;
  let invites = config.invites;

  if (!repository || !invites) {
    database = await createDatabase(config.dbLocation ?? ":memory:", config.authToken);
    repository ??= new DrizzleSongRepository(database.db);
    invites ??= new DrizzleInviteRepository(database.db);
  }

  const verifier =
    config.verifier ??
    (() => {
      if (!config.googleClientId) {
        throw new Error("GOOGLE_CLIENT_ID is required to verify tokens (or inject a verifier)");
      }
      return new GoogleTokenVerifier(config.googleClientId);
    })();

  const requireInvitedMw = requireInvited({ verifier, invites });
```

Add `invites` and `requireInvited: requireInvitedMw` to the returned object.

- [ ] **Step 4: Guard the write routes**

In `apps/backend/src/routes/songs.routes.ts`, change the signature and guard the four write routes:

```ts
import { Router, type RequestHandler } from "express";
import type { SongsController } from "../controllers/songs.controller.js";
import { asyncHandler } from "../http/errors.js";

export function createSongsRouter(controller: SongsController, requireInvited: RequestHandler): Router {
  const router = Router();

  router.get("/search", asyncHandler(controller.search));
  router.get("/", asyncHandler(controller.list));
  router.post("/batch", requireInvited, asyncHandler(controller.batchImport));
  router.post("/", requireInvited, asyncHandler(controller.create));
  router.get("/:id/suggestions", asyncHandler(controller.suggestions));
  router.get("/:id", asyncHandler(controller.get));
  router.put("/:id", requireInvited, asyncHandler(controller.update));
  router.delete("/:id", requireInvited, asyncHandler(controller.remove));

  return router;
}
```

- [ ] **Step 5: Wire the app + `/api/auth/me`**

In `apps/backend/src/app.ts`, pass the middleware and add the route (before `errorMiddleware`):

```ts
  app.use("/api/songs", createSongsRouter(container.controller, container.requireInvited));

  app.get("/api/auth/me", container.requireInvited, (req, res) => {
    res.json({ email: req.user!.email });
  });
```

- [ ] **Step 6: Pass the client id from the environment**

In `apps/backend/src/server.ts`, add after the existing env reads:

```ts
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
```

and include it in the `createContainer` call:

```ts
const container = await createContainer({
  dbLocation: DB_LOCATION,
  authToken: AUTH_TOKEN,
  googleClientId: GOOGLE_CLIENT_ID,
});
```

In `apps/backend/.env`, add:

```
# Google OAuth 2.0 Web client id — must match the frontend's VITE_GOOGLE_CLIENT_ID.
GOOGLE_CLIENT_ID=""
```

- [ ] **Step 7: Run the full backend suite**

Run: `pnpm --filter @medleys/backend test`
Expected: PASS (updated app tests, new auth tests, all prior tests).

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @medleys/backend run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/container.ts apps/backend/src/routes/songs.routes.ts apps/backend/src/app.ts apps/backend/src/server.ts apps/backend/src/app.test.ts apps/backend/.env
git commit -m "feat(backend): guard write routes with requireInvited and add /api/auth/me"
```

---

### Task 4: Frontend token store + Bearer header on the API client

**Files:**
- Create: `apps/frontend/src/api/token-store.ts`
- Modify: `apps/frontend/src/api/client.ts`
- Test: `apps/frontend/src/api/client.test.ts` (add cases)

**Interfaces:**
- Produces:
  - `getToken(): string | null`, `setToken(token: string | null): void`, `subscribe(fn: () => void): () => void` from `api/token-store.js`.
  - `client.ts` attaches `Authorization: Bearer <token>` when a token is set, and clears the token on any `401`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/frontend/src/api/client.test.ts`:

```ts
import { getToken, setToken } from "./token-store.js";

describe("auth header", () => {
  afterEach(() => setToken(null));

  it("attaches a Bearer header when a token is set", async () => {
    setToken("tok-123");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

    await api.searchSongs("x");

    const [, init] = fetchSpy.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("omits the Authorization header when no token is set", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

    await api.searchSongs("x");

    const [, init] = fetchSpy.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("clears the token on a 401", async () => {
    setToken("tok-123");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Not invited" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.createSong({} as never)).rejects.toThrow();
    expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @medleys/frontend test client`
Expected: FAIL — cannot import `./token-store.js`; no Authorization header.

- [ ] **Step 3: Write the token store**

Create `apps/frontend/src/api/token-store.ts`:

```ts
const STORAGE_KEY = "medleys.token";

let token: string | null = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
const subscribers = new Set<() => void>();

export function getToken(): string | null {
  return token;
}

export function setToken(next: string | null): void {
  token = next;
  if (typeof localStorage !== "undefined") {
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  }
  subscribers.forEach((fn) => fn());
}

/** Subscribe to token changes; returns an unsubscribe fn. */
export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
```

- [ ] **Step 4: Attach the header and clear on 401 in the client**

In `apps/frontend/src/api/client.ts`, import the store and update `request`:

```ts
import { getToken, setToken } from "./token-store.js";
```

Replace the `fetch` call + error block inside `request` with:

```ts
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 401) setToken(null);
  if (!res.ok) {
```

(The rest of the error handling stays as-is.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @medleys/frontend test client`
Expected: PASS (new and existing client tests).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/api/token-store.ts apps/frontend/src/api/client.ts apps/frontend/src/api/client.test.ts
git commit -m "feat(frontend): token store and Bearer auth header on API client"
```

---

### Task 5: `useAuth` context + Google Identity Services provider

**Files:**
- Modify: `apps/frontend/src/vite-env.d.ts` (type `VITE_GOOGLE_CLIENT_ID`)
- Create: `apps/frontend/src/api/useAuth.tsx`
- Modify: `apps/frontend/src/main.tsx` (wrap in `AuthProvider`)
- Test: `apps/frontend/src/api/useAuth.test.tsx`

**Interfaces:**
- Consumes: `getToken`, `setToken`, `subscribe` (Task 4); `api` base URL indirectly via a direct `fetch` to `/api/auth/me`.
- Produces:
  - `AuthProvider` component.
  - `useAuth(): { user: { email: string } | null; token: string | null; signIn(): void; signOut(): void }`.

- [ ] **Step 1: Type the env var**

In `apps/frontend/src/vite-env.d.ts`, add the client id to the env interface (create the interface if the file only has the triple-slash ref):

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/frontend/src/api/useAuth.test.tsx`:

```ts
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./useAuth.js";
import { setToken } from "./token-store.js";

// Minimal GIS mock: capture the callback so the test can fire a credential.
let gisCallback: (resp: { credential: string }) => void;
beforeEach(() => {
  setToken(null);
  (globalThis as unknown as { google: unknown }).google = {
    accounts: {
      id: {
        initialize: (opts: { callback: (resp: { credential: string }) => void }) => {
          gisCallback = opts.callback;
        },
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
      },
    },
  };
});
afterEach(() => vi.restoreAllMocks());

function Probe() {
  const { user, signIn } = useAuth();
  return (
    <div>
      <button onClick={signIn}>sign in</button>
      <span data-testid="email">{user?.email ?? "anon"}</span>
    </div>
  );
}

describe("useAuth", () => {
  it("starts anonymous and becomes the invited user after a Google credential", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ email: "friend@gmail.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("email")).toHaveTextContent("anon");

    await userEvent.click(screen.getByText("sign in"));
    gisCallback({ credential: "google-jwt" });

    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("friend@gmail.com"));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @medleys/frontend test useAuth`
Expected: FAIL — cannot import `./useAuth.js`.

- [ ] **Step 4: Implement the provider/hook**

Create `apps/frontend/src/api/useAuth.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getToken, setToken, subscribe } from "./token-store.js";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

interface AuthState {
  user: { email: string } | null;
  token: string | null;
  signIn: () => void;
  signOut: () => void;
}

interface GoogleId {
  initialize: (opts: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
  prompt: () => void;
  disableAutoSelect: () => void;
}

function googleId(): GoogleId | undefined {
  return (globalThis as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/** Fetch the invited caller's email; null if the current token is missing/uninvited. */
async function fetchMe(): Promise<{ email: string } | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    setToken(null);
    return null;
  }
  return (await res.json()) as { email: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());

  // Initialise GIS once; its callback stores the credential and resolves the user.
  useEffect(() => {
    const gid = googleId();
    gid?.initialize({
      client_id: CLIENT_ID,
      callback: (resp) => {
        setToken(resp.credential);
        void fetchMe().then(setUser);
      },
    });
  }, []);

  // Mirror token-store changes (e.g. a 401 clearing the token elsewhere).
  useEffect(() => {
    const unsub = subscribe(() => {
      const next = getToken();
      setTokenState(next);
      if (!next) setUser(null);
    });
    return unsub;
  }, []);

  // On first load with a persisted token, confirm we're still invited.
  useEffect(() => {
    void fetchMe().then(setUser);
  }, []);

  const signIn = useCallback(() => googleId()?.prompt(), []);
  const signOut = useCallback(() => {
    googleId()?.disableAutoSelect();
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, token, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
```

- [ ] **Step 5: Load the GIS script and wrap the app**

In `apps/frontend/index.html`, add inside `<head>`:

```html
<script src="https://accounts.google.com/gsi/client" async></script>
```

In `apps/frontend/src/main.tsx`, import and wrap `<App />`:

```tsx
import { AuthProvider } from "./api/useAuth.js";
```

Wrap so the tree is `QueryClientProvider > BrowserRouter > AuthProvider > App`:

```tsx
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @medleys/frontend test useAuth`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/vite-env.d.ts apps/frontend/src/api/useAuth.tsx apps/frontend/src/api/useAuth.test.tsx apps/frontend/src/main.tsx apps/frontend/index.html
git commit -m "feat(frontend): useAuth context backed by Google Identity Services"
```

---

### Task 6: NavBar sign-in control + gate edit controls on `user`

**Files:**
- Modify: `apps/frontend/src/components/organisms/NavBar.tsx`
- Test: `apps/frontend/src/components/organisms/NavBar.test.tsx` (create)
- Modify: `apps/frontend/src/pages/SongsPage.tsx` (gate add/edit UI)
- Modify: `apps/frontend/src/pages/SongsPage.test.tsx` (mock `useAuth`)

**Interfaces:**
- Consumes: `useAuth` (Task 5).
- Produces: NavBar shows a "Got invited?"/"Sign in" control when signed out and the email + "Sign out" when signed in; `SongsPage` hides the add form and edit affordances when `user` is null.

- [ ] **Step 1: Write the failing NavBar test**

Create `apps/frontend/src/components/organisms/NavBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/utils.js";
import { NavBar } from "./NavBar.js";
import * as auth from "../../api/useAuth.js";

describe("NavBar", () => {
  it("shows a 'Got invited?' sign-in control when signed out", () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: null,
      token: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderWithProviders(<NavBar />);
    expect(screen.getByRole("button", { name: /got invited/i })).toBeInTheDocument();
  });

  it("shows the email and a sign-out control when signed in", () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { email: "friend@gmail.com" },
      token: "t",
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderWithProviders(<NavBar />);
    expect(screen.getByText("friend@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @medleys/frontend test NavBar`
Expected: FAIL — no sign-in control rendered.

- [ ] **Step 3: Add the sign-in control to NavBar**

In `apps/frontend/src/components/organisms/NavBar.tsx`, import the hook and render the control in the `<nav>` after the existing links. The signed-out control shows "Got invited?" and swaps to "Sign in" on hover via a group hover (label text swap):

```tsx
import { useAuth } from "../../api/useAuth.js";
```

Inside the component, before `return`:

```tsx
  const { user, signIn, signOut } = useAuth();
```

Add to the end of `<nav>`:

```tsx
          {user ? (
            <div className="flex items-center gap-2 pl-2">
              <span className="text-sm text-sepia">{user.email}</span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-sepia transition-colors hover:bg-parchment"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signIn}
              aria-label="Got invited? Sign in"
              className="group relative rounded-full bg-rust px-4 py-1.5 text-sm font-semibold text-cream transition-colors hover:bg-wax"
            >
              <span className="group-hover:hidden">Got invited?</span>
              <span className="hidden group-hover:inline">Sign in</span>
            </button>
          )}
```

- [ ] **Step 4: Run NavBar test to verify it passes**

Run: `pnpm --filter @medleys/frontend test NavBar`
Expected: PASS. (The accessible name stays "Got invited? Sign in" via `aria-label`, so both `/got invited/i` and hover work.)

- [ ] **Step 5: Write the failing SongsPage gating test**

In `apps/frontend/src/pages/SongsPage.test.tsx`, add a mock for `useAuth` at the top (import `vi` and `* as auth from "../api/useAuth.js"`), defaulting to signed-out, and add:

```tsx
it("hides the add-song form when signed out", () => {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: null, token: null, signIn: vi.fn(), signOut: vi.fn() });
  // ...render SongsPage with a mocked empty list as the existing tests do...
  expect(screen.queryByRole("button", { name: /add song/i })).not.toBeInTheDocument();
});

it("shows the add-song form when signed in", () => {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: { email: "friend@gmail.com" }, token: "t", signIn: vi.fn(), signOut: vi.fn() });
  // ...render SongsPage with a mocked empty list...
  expect(screen.getByRole("button", { name: /add song/i })).toBeInTheDocument();
});
```

Match the existing SongsPage test's render/fetch-mock setup for the list; only the `useAuth` mock and the assertion differ. Use the actual accessible name of the add-song trigger as it appears in `SongsPage.tsx` (adjust the `/add song/i` matcher to the real label).

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @medleys/frontend test SongsPage`
Expected: FAIL — add-song UI renders regardless of auth.

- [ ] **Step 7: Gate the edit UI in SongsPage**

In `apps/frontend/src/pages/SongsPage.tsx`:

```tsx
import { useAuth } from "../api/useAuth.js";
```

Add `const { user } = useAuth();` in the component. Then:
- Pass an `canEdit={Boolean(user)}` prop down to `SongCard` so its `onEdit` affordance only renders when editing is allowed (update `SongCard` to hide its edit button when `canEdit` is false).
- Wrap the right-hand `<section>` that contains the add/edit form + import so it renders only when `user` is truthy: `{user ? ( <section> ... </section> ) : null}`.

- [ ] **Step 8: Run the frontend suite + typecheck + build**

Run: `pnpm --filter @medleys/frontend test`
Expected: PASS.
Run: `pnpm --filter @medleys/frontend run typecheck`
Expected: no errors.
Run: `pnpm --filter @medleys/frontend run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/components/organisms/NavBar.tsx apps/frontend/src/components/organisms/NavBar.test.tsx apps/frontend/src/pages/SongsPage.tsx apps/frontend/src/pages/SongsPage.test.tsx apps/frontend/src/components/molecules/SongCard.tsx
git commit -m "feat(frontend): sign-in control and gate edit UI on invited user"
```

---

### Task 7: Document setup and the invite process

**Files:**
- Modify: `README.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Add an Authentication section to the README**

In `README.md`, add a section covering:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document Google auth setup and the invite process"
```

---

## Notes for the executor

- `GET /api/auth/me` and every write are protected by the **same** middleware instance from the container — never construct a second one.
- In tests, always inject `verifier` + `invites` into `createContainer` (never rely on `GOOGLE_CLIENT_ID`), and add a `Bearer` header to write requests.
- The frontend's read paths must keep working with no token; only writes and `/api/auth/me` require one.
- GIS (`window.google.accounts.id`) is loaded from a script tag in `index.html`; components must tolerate it being briefly `undefined` on first paint (the `googleId()` helper returns `undefined` safely).
