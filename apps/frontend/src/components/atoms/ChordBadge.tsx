import { cn } from "../../lib/cn.js";

/** A single chord chip, monospaced so progressions align. */
export function ChordBadge({ chord, muted = false }: { chord: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.75rem] items-center justify-center rounded-md border px-2 py-1 font-mono text-sm",
        muted
          ? "border-dust/60 bg-parchment/60 text-sepia/70"
          : "border-dust bg-parchment text-wax shadow-groove",
      )}
    >
      {chord}
    </span>
  );
}
