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
