import { ChordBadge } from "../atoms/ChordBadge.js";

/** A labelled row of chord badges (e.g. "Verse   C  G  Am  F"). */
export function ChordRow({ label, chords }: { label: string; chords: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-sepia/70">
        {label}
      </span>
      {chords.length === 0 ? (
        <span className="text-sm italic text-dust">—</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chords.map((chord, i) => (
            <ChordBadge key={`${chord}-${i}`} chord={chord} />
          ))}
        </div>
      )}
    </div>
  );
}
