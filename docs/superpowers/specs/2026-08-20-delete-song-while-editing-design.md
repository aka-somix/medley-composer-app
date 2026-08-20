# Delete a song while editing — design

## Goal

Let the user delete a song from the edit panel on the Songs page, with a styled
confirmation step. On success the edit panel closes and returns to the "Add a
song" form, and the library list refreshes without the deleted song.

## Scope & context

The backend already exposes `DELETE /api/songs/:id` end-to-end (route →
controller → service → Drizzle repo, returning `204`). The `songs` table is the
only table — no foreign keys, no join tables. Alternate verses are a nullable
column on the song row; medley chains are ephemeral frontend state and persist
nothing. So **deleting a song has no server-side cascade or orphan risk**; a
stale `/chain/:id` link simply won't resolve.

This is therefore a **frontend-only** wiring job plus one new reusable molecule.
No backend, no schema, no new dependency.

## Components & changes

### 1. `api/client.ts` — `deleteSong`
Add to the `api` object:

```ts
deleteSong: (id: string) =>
  request<void>(`/api/songs/${id}`, { method: "DELETE" }),
```

`request` already returns `undefined` for `204` (client.ts:26), so no special
handling is needed.

### 2. `api/hooks.ts` — `useDeleteSong`
Follow the existing mutation pattern (mirrors `useUpdateSong`):

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

### 3. `components/molecules/ConfirmDialog.tsx` — new molecule
First confirmation pattern in the app. A small, reusable, presentational
molecule (no network → molecule, not organism) built on the native `<dialog>`
element, styled with the vinyl palette (`cream`/`dust`/`sepia`/`rust`) and the
existing `Button` atom.

Props:

```ts
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;   // default "Delete"
  cancelLabel?: string;    // default "Cancel"
  confirmVariant?: Variant; // default "primary"
  busy?: boolean;          // disables buttons + shows pending label
  onConfirm: () => void;
  onCancel: () => void;
}
```

Behavior:
- Uses a `ref` to the `<dialog>`; call `showModal()` when `open` becomes true and
  `close()` when it becomes false (via `useEffect` on `open`). `showModal()` gives
  us the native backdrop, focus trap, and top-layer stacking for free.
- The dialog's `onClose` (Esc / backdrop dismissal) calls `onCancel`, so parent
  state stays in sync.
- Confirm button is disabled while `busy` and shows a pending label.
- Accessible name via the rendered `title` heading tied to the dialog with
  `aria-labelledby`; message tied with `aria-describedby`.

Kept generic (not delete-specific) so future destructive actions — e.g. the
unconfirmed chain-node remove — can reuse it. No styling of the native backdrop
beyond a Tailwind `backdrop:` utility.

### 4. `components/organisms/SongForm.tsx` — Delete affordance (edit mode only)
The delete UI lives in the edit panel, and `SongForm` already owns the song and
the mutation patterns, so it's the natural home.

- Add an optional `onDeleted?: () => void` prop.
- When `editing` is true, render a **Delete** button (variant `outline`, rust
  text) in the form's action row, alongside the existing submit button.
- Clicking Delete opens the `ConfirmDialog` (local `confirmOpen` state) — it does
  **not** delete immediately.
- Confirming calls `useDeleteSong().mutate(song.id, { onSuccess: onDeleted })`.
- `busy` on the dialog = the delete mutation's `isPending`.
- Delete errors surface in the same inline `role="alert"` area the form already
  uses for mutation errors.

### 5. `pages/SongsPage.tsx` — wire `onDeleted`
The edit-mode `<SongForm>` (SongsPage.tsx:46-53) gets:

```tsx
onDeleted={() => {
  setEditingSong(null);
  setPage(1);
}}
```

Identical to the existing `onSaved` handler → panel closes back to "Add a song",
list refreshes.

## Data flow

Delete click → `ConfirmDialog` opens → Confirm → `useDeleteSong.mutate(id)` →
`api.deleteSong` → `DELETE /api/songs/:id` → `204` → `onSuccess` invalidates
`["songs"]` (list refetches) → `onDeleted()` clears `editingSong` and resets to
page 1.

## Error handling

- Network / server error → mutation `isError`; message shown in the form's inline
  `role="alert"` block. The dialog stays open (buttons re-enabled) so the user can
  retry or cancel.
- Song already gone (`404` → `NotFoundError` from the service) → same inline error
  path; the list invalidation will drop the stale card regardless.

## Testing (TDD, RTL + Vitest)

Behavior through the accessible UI, network mocked via `vi.spyOn(globalThis,
"fetch", …)`:

1. **`ConfirmDialog.test.tsx`** — renders title/message when `open`; Confirm fires
   `onConfirm`; Cancel and Esc fire `onCancel`; buttons disabled when `busy`.
2. **`SongForm` (delete path)** — in edit mode a "Delete" button is present (absent
   in create mode); clicking it opens the confirm dialog without calling the
   network; confirming issues `DELETE /api/songs/:id` and calls `onDeleted` on
   success; a failed delete shows an inline error and keeps the dialog open.

`pnpm --filter @medleys/frontend test`, `run typecheck`, and `run build` must all
be green.

## Out of scope (YAGNI)

- Undo / soft-delete / toast notifications — the app has no notification system
  today; success is communicated by the panel closing and the card disappearing.
- Bulk delete, delete from `SongCard` in the list, keyboard-shortcut delete.
- Retrofitting the chain-node remove to use `ConfirmDialog` (the molecule is built
  reusable, but wiring it there is a separate change).
