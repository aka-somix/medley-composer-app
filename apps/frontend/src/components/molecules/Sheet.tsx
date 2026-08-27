import { useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  id?: string;
  children: ReactNode;
}

/**
 * Top-sliding panel built on the native <dialog> element: showModal() gives us
 * the backdrop, focus trap, top-layer stacking and Esc-to-close for free.
 * Children render only while open so their contents stay out of the DOM at rest.
 */
export function Sheet({ open, onClose, label, id, children }: SheetProps) {
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
      id={id}
      aria-label={label}
      onClose={onClose}
      // Touch devices have no Esc key and the backdrop is not dismissible by
      // default, so without this the sheet is a trap. A click landing on the
      // <dialog> itself (rather than a child) is a backdrop click.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-0 w-full max-w-none rounded-b-2xl border-b border-dust bg-cream p-4 text-sepia shadow-vinyl backdrop:bg-wax/40"
    >
      {open ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-11 w-11 shrink-0 place-items-center self-end rounded-full text-2xl text-sepia transition-colors hover:bg-parchment"
          >
            ×
          </button>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
