# Delete a Song While Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user delete a song from the edit panel on the Songs page, behind a styled confirmation dialog.

**Architecture:** The backend `DELETE /api/songs/:id` already exists and is fully wired (returns `204`), and there is no cascade/orphan risk (one table, no FKs; alternate verses are a column; chains are ephemeral). So this is a frontend-only change: add a `deleteSong` client call and `useDeleteSong` hook, a reusable `ConfirmDialog` molecule (native `<dialog>`), a Delete button in `SongForm` (edit mode only), and wiring in `SongsPage` to close the panel and refresh the list on success.

**Tech Stack:** React 18, TypeScript (strict, ESM with `.js` import extensions), Vite, Tailwind (vinyl palette), TanStack Query, react-router-dom. Tests: Vitest + React Testing Library (jsdom), `renderWithProviders` from `src/test/utils.tsx`, network mocked via `vi.spyOn(globalThis, "fetch", …)`.

**Spec:** `docs/superpowers/specs/2026-08-20-delete-song-while-editing-design.md`

## Global Constraints

- **Data layer only through `api/client.ts` → TanStack Query hooks in `api/hooks.ts`.** Components never call `fetch` directly. All song mutations invalidate the `["songs"]` query key. (`.claude/rules/frontend.md`)
- **Atomic design:** `ConfirmDialog` is a molecule (no network) under `components/molecules/`.
- **Styling:** Tailwind palette tokens only (`cream`, `parchment`, `dust`, `sepia`, `wax`, `mustard`, `amber`, `rust`, `teal`) — no raw hex. Headings `font-display`. Mobile-first, responsive.
- **Accessibility:** every interactive control has an accessible name; error/loading states are announced (`role="alert"`).
- **TS:** strict, no `any`; function components + hooks; ESM `.js` import extensions on all relative imports.
- **Green gates:** `pnpm --filter @medleys/frontend test`, `run typecheck`, and `run build` must all pass.
- **Commits:** repo uses Conventional Commits (`feat:` / `test:` / `refactor:`). **Do NOT run `git commit` in this plan — the user asked to hold off on commits.** Leave each task's changes staged (`git add`) and let the user commit. (If the user later re-enables commits, the commit message is given in each task's final step.)

---

### Task 1: API layer — `deleteSong` client call + `useDeleteSong` hook

**Files:**
- Modify: `apps/frontend/src/api/client.ts` (add to the `api` object, after `getSuggestions` at line 45)
- Modify: `apps/frontend/src/api/hooks.ts` (add hook after `useImportSongs`, line 64)
- Test: `apps/frontend/src/api/client.test.ts` (create)

**Interfaces:**
- Consumes: existing `request<T>` helper (already handles `204 → undefined`, client.ts:26).
- Produces:
  - `api.deleteSong(id: string): Promise<void>`
  - `useDeleteSong(): UseMutationResult<void, Error, string>` — `mutate(id)` deletes and invalidates `["songs"]`.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/api/client.test.ts`:

```ts
import { afterEach, describe, it, expect, vi } from "vitest";
import { api } from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api.deleteSong", () => {
  it("issues a DELETE to /api/songs/:id and resolves undefined on 204", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const result = await api.deleteSong("s1");

    expect(result).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/songs\/s1$/);
    expect(init?.method).toBe("DELETE");
  });

  it("throws with the server error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.deleteSong("nope")).rejects.toThrow("Song not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @medleys/frontend test src/api/client.test.ts`
Expected: FAIL — `api.deleteSong is not a function`.

- [ ] **Step 3: Add `deleteSong` to the client**

In `apps/frontend/src/api/client.ts`, add this property to the `api` object (e.g. right after the `getSuggestions` line):

```ts
  deleteSong: (id: string) =>
    request<void>(`/api/songs/${id}`, { method: "DELETE" }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @medleys/frontend test src/api/client.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Add the `useDeleteSong` hook**

In `apps/frontend/src/api/hooks.ts`, append after `useImportSongs` (mirrors `useUpdateSong`):

```ts
export function useDeleteSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSong(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}
```

(No dedicated hook test — consistent with the existing untested `useCreateSong`/`useUpdateSong`; the hook is exercised end-to-end in Tasks 3 and 4.)

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @medleys/frontend run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 7: Stage (do not commit)**

```bash
git add apps/frontend/src/api/client.ts apps/frontend/src/api/hooks.ts apps/frontend/src/api/client.test.ts
```

If commits are re-enabled: `git commit -m "feat(frontend): deleteSong client call and useDeleteSong hook"`

---

### Task 2: `ConfirmDialog` molecule (native `<dialog>`)

**Files:**
- Create: `apps/frontend/src/components/molecules/ConfirmDialog.tsx`
- Modify: `apps/frontend/src/components/atoms/Button.tsx` (export the `Variant` type so `ConfirmDialog` can reuse it)
- Test: `apps/frontend/src/components/molecules/ConfirmDialog.test.tsx` (create)

**Interfaces:**
- Consumes: `Button` atom; `Variant` type from `Button.tsx`; `cn` from `lib/cn.ts`.
- Produces:
  ```ts
  interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;    // default "Delete"
    cancelLabel?: string;     // default "Cancel"
    confirmVariant?: Variant; // default "primary"
    busy?: boolean;           // disables buttons; confirm shows "Working…"
    onConfirm: () => void;
    onCancel: () => void;
  }
  export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null;
  ```
  Renders nothing (returns `null` content inside the dialog) when `open` is false; when open, shows `title` (as the dialog's accessible name via `aria-labelledby`), `message`, and Cancel/Confirm buttons.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/components/molecules/ConfirmDialog.test.tsx`:

```tsx
import { afterEach, describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { renderWithProviders } from "../../test/utils.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const base = {
  title: "Delete song?",
  message: "This cannot be undone.",
  onConfirm: () => {},
  onCancel: () => {},
};

describe("ConfirmDialog", () => {
  it("shows the title and message when open", () => {
    renderWithProviders(<ConfirmDialog {...base} open />);
    expect(screen.getByRole("heading", { name: /delete song\?/i })).toBeInTheDocument();
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument();
  });

  it("does not render its content when closed", () => {
    renderWithProviders(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByText(/this cannot be undone/i)).not.toBeInTheDocument();
  });

  it("fires onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDialog {...base} open onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onCancel when the cancel button is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDialog {...base} open onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while busy", () => {
    renderWithProviders(<ConfirmDialog {...base} open busy />);
    expect(screen.getByRole("button", { name: /working/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @medleys/frontend test src/components/molecules/ConfirmDialog.test.tsx`
Expected: FAIL — cannot resolve `./ConfirmDialog.js`.

- [ ] **Step 3: Export the `Variant` type from Button**

In `apps/frontend/src/components/atoms/Button.tsx`, change:

```ts
type Variant = "primary" | "ghost" | "outline";
```

to:

```ts
export type Variant = "primary" | "ghost" | "outline";
```

- [ ] **Step 4: Implement `ConfirmDialog`**

Create `apps/frontend/src/components/molecules/ConfirmDialog.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { Button, type Variant } from "../atoms/Button.js";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: Variant;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog built on the native <dialog> element.
 * showModal() gives us the backdrop, focus trap, and top-layer stacking for
 * free; Esc / backdrop dismissal routes through onClose → onCancel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      // ponytail: jsdom historically ships showModal as a no-op/throw; fall
      // back to the `open` attribute so the dialog is still visible + testable.
      try {
        dialog.showModal();
      } catch {
        dialog.open = true;
      }
    } else {
      try {
        dialog.close();
      } catch {
        dialog.open = false;
      }
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onClose={onCancel}
      className="rounded-2xl border border-dust bg-cream p-6 text-sepia shadow-vinyl backdrop:bg-wax/40"
    >
      {open ? (
        <div className="flex max-w-sm flex-col gap-4">
          <h2 id="confirm-dialog-title" className="font-display text-2xl">
            {title}
          </h2>
          <p id="confirm-dialog-message" className="text-sm text-sepia/80">
            {message}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @medleys/frontend test src/components/molecules/ConfirmDialog.test.tsx`
Expected: PASS (all 5 cases). If the "busy" or "confirm" query fails because jsdom doesn't reflect `showModal`, the `try/catch` fallback setting `dialog.open = true` keeps content visible — confirm the fallback branch is present.

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @medleys/frontend run typecheck`
Expected: PASS.

- [ ] **Step 7: Stage (do not commit)**

```bash
git add apps/frontend/src/components/molecules/ConfirmDialog.tsx apps/frontend/src/components/molecules/ConfirmDialog.test.tsx apps/frontend/src/components/atoms/Button.tsx
```

If commits are re-enabled: `git commit -m "feat(frontend): reusable ConfirmDialog molecule"`

---

### Task 3: Delete affordance in `SongForm` (edit mode only)

**Files:**
- Modify: `apps/frontend/src/components/organisms/SongForm.tsx`
- Test: `apps/frontend/src/components/organisms/SongForm.test.tsx` (create)

**Interfaces:**
- Consumes: `useDeleteSong` (Task 1); `ConfirmDialog` (Task 2).
- Produces: `SongForm` gains an optional prop `onDeleted?: () => void`. In edit mode it renders a **Delete** button (`variant="outline"`, rust text) that opens a `ConfirmDialog`; confirming calls `deleteSong.mutate(song.id, { onSuccess: onDeleted })`.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/components/organisms/SongForm.test.tsx`:

```tsx
import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Song } from "@medleys/shared";
import { SongForm } from "./SongForm.js";
import { renderWithProviders } from "../../test/utils.js";

const SONG: Song = {
  id: "s1",
  title: "Cream Sky",
  artist: "The Grooves",
  bpm: 96,
  scale: "C",
  language: "English",
  verseDegrees: ["1", "5", "6m", "4"],
  chorusDegrees: ["4", "1", "5", "6m"],
  bridgeDegrees: null,
  alternateVerseDegrees: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SongForm delete", () => {
  it("shows no Delete button in create mode", () => {
    renderWithProviders(<SongForm />);
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog on Delete without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} />);

    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));

    expect(screen.getByRole("heading", { name: /delete song\?/i })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("deletes and calls onDeleted when confirmed", async () => {
    const onDeleted = vi.fn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/songs\/s1$/);
    expect(init?.method).toBe("DELETE");
  });

  it("shows an inline error and does not call onDeleted when delete fails", async () => {
    const onDeleted = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/song not found/i);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
```

Note: the Delete button's accessible name is `Delete {title}` (via `aria-label`) so it's distinguishable from the dialog's `Delete` confirm button; the confirm button matches `/^delete$/i`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/SongForm.test.tsx`
Expected: FAIL — no `Delete cream sky` button exists.

- [ ] **Step 3: Wire delete into `SongForm`**

Edit `apps/frontend/src/components/organisms/SongForm.tsx`:

3a. Update imports at the top:

```ts
import { useState, type FormEvent } from "react";
import type { CreateSongInput, Song } from "@medleys/shared";
import { Button } from "../atoms/Button.js";
import { Input } from "../atoms/Input.js";
import { FormField } from "../molecules/FormField.js";
import { ConfirmDialog } from "../molecules/ConfirmDialog.js";
import { useCreateSong, useUpdateSong, useDeleteSong } from "../../api/hooks.js";
import { transpose } from "../../lib/scales.js";
```

3b. Extend the prop type and destructuring to add `onDeleted`:

```ts
export function SongForm({
  song,
  onCreated,
  onSaved,
  onDeleted,
}: {
  song?: Song;
  onCreated?: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
```

3c. After the existing `const mutation = editing ? updateSong : createSong;` line, add the delete mutation and dialog state:

```ts
  const deleteSong = useDeleteSong();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    if (!song) return;
    deleteSong.mutate(song.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        onDeleted?.();
      },
    });
  };
```

3d. Surface delete errors alongside the existing mutation error block. Replace the existing error paragraph (currently keyed on `mutation.isError`) with a version that also covers the delete mutation:

```tsx
      {mutation.isError || deleteSong.isError ? (
        <p className="text-sm text-rust" role="alert">
          {((mutation.error ?? deleteSong.error) as Error).message}
        </p>
      ) : null}
```

3e. In the final action row, add the Delete button (edit mode only) beside the submit button, and render the dialog. Replace the closing action `<div>` block:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {editing
            ? mutation.isPending
              ? "Saving…"
              : "Save changes"
            : mutation.isPending
              ? "Adding…"
              : "Add song"}
        </Button>
        {editing && song ? (
          <Button
            type="button"
            variant="outline"
            className="text-rust"
            aria-label={`Delete ${song.title}`}
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        ) : null}
      </div>

      {editing && song ? (
        <ConfirmDialog
          open={confirmOpen}
          title="Delete song?"
          message={`“${song.title}” will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="primary"
          busy={deleteSong.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @medleys/frontend test src/components/organisms/SongForm.test.tsx`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @medleys/frontend run typecheck`
Expected: PASS.

- [ ] **Step 6: Stage (do not commit)**

```bash
git add apps/frontend/src/components/organisms/SongForm.tsx apps/frontend/src/components/organisms/SongForm.test.tsx
```

If commits are re-enabled: `git commit -m "feat(frontend): delete button + confirm in SongForm edit mode"`

---

### Task 4: Wire `onDeleted` in `SongsPage` + end-to-end proof

**Files:**
- Modify: `apps/frontend/src/pages/SongsPage.tsx:46-53`
- Test: `apps/frontend/src/pages/SongsPage.test.tsx` (create)

**Interfaces:**
- Consumes: `SongForm`'s `onDeleted` prop (Task 3); existing `useSongList` (via mocked `fetch`).
- Produces: on delete success, `editingSong` is cleared (panel returns to "Add a song") and `page` resets to 1 (list refetch).

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/pages/SongsPage.test.tsx`:

```tsx
import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Paginated, Song } from "@medleys/shared";
import { SongsPage } from "./SongsPage.js";
import { renderWithProviders } from "../test/utils.js";

const SONG: Song = {
  id: "s1",
  title: "Cream Sky",
  artist: "The Grooves",
  bpm: 96,
  scale: "C",
  language: "English",
  verseDegrees: ["1", "5", "6m", "4"],
  chorusDegrees: ["4", "1", "5", "6m"],
  bridgeDegrees: null,
  alternateVerseDegrees: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SongsPage delete flow", () => {
  it("closes the edit panel back to 'Add a song' after a confirmed delete", async () => {
    const list: Paginated<Song> = { items: [SONG], total: 1, page: 1, pageSize: 8 };
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(jsonResponse(list));
    });
    const user = userEvent.setup();
    renderWithProviders(<SongsPage />);

    // Enter edit mode from the song card.
    await user.click(await screen.findByRole("button", { name: /edit cream sky/i }));
    expect(screen.getByRole("heading", { name: /edit song/i })).toBeInTheDocument();

    // Delete → confirm.
    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    // Panel returns to "Add a song".
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /add a song/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("heading", { name: /edit song/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @medleys/frontend test src/pages/SongsPage.test.tsx`
Expected: FAIL — after confirming delete the panel still shows "Edit song" (no `onDeleted` wired yet).

- [ ] **Step 3: Wire `onDeleted` in `SongsPage`**

In `apps/frontend/src/pages/SongsPage.tsx`, update the edit-mode `<SongForm>` (lines 46-53) to add the `onDeleted` handler:

```tsx
            <SongForm
              key={editingSong.id}
              song={editingSong}
              onSaved={() => {
                setEditingSong(null);
                setPage(1);
              }}
              onDeleted={() => {
                setEditingSong(null);
                setPage(1);
              }}
            />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @medleys/frontend test src/pages/SongsPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck + build**

Run:
```bash
pnpm --filter @medleys/frontend test
pnpm --filter @medleys/frontend run typecheck
pnpm --filter @medleys/frontend run build
```
Expected: all green.

- [ ] **Step 6: Stage (do not commit)**

```bash
git add apps/frontend/src/pages/SongsPage.tsx apps/frontend/src/pages/SongsPage.test.tsx
```

If commits are re-enabled: `git commit -m "feat(frontend): wire song delete into SongsPage edit panel"`

---

## Manual verification (after all tasks)

1. `pnpm --filter @medleys/backend run dev` (or the repo's dev command) and `pnpm --filter @medleys/frontend run dev`.
2. Open the Songs page, click **Edit** on a song.
3. Click **Delete** → confirm dialog appears with the song title; Esc / Cancel dismisses it without deleting.
4. Confirm → the panel returns to "Add a song" and the song is gone from the list.
5. Verify at mobile width the edit panel's action row (Save / Delete) wraps and the dialog is centered/readable.
