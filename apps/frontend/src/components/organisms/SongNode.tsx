import type { Song } from "@medleys/shared";
import { ChordRow } from "../molecules/ChordRow.js";
import { Tag } from "../atoms/Tag.js";
import { transpose } from "../../lib/scales.js";

/** A single node in the medley chain, with chords transposed to the display scale. */
export function SongNode({
  song,
  displayScale,
  index,
  onRemove,
}: {
  song: Song;
  displayScale: string;
  index: number;
  /** When provided, renders an ✕ that removes this song from the chain. */
  onRemove?: () => void;
}) {
  return (
    <article className="relative flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-dust bg-cream/80 p-5 shadow-vinyl sm:w-80">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${song.title} from the chain`}
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-dust bg-cream text-sm text-sepia/70 shadow-vinyl transition-colors hover:border-rust hover:text-rust"
        >
          ✕
        </button>
      ) : null}
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-mustard">#{index + 1}</span>
          <h3 className="truncate text-xl font-semibold leading-tight">{song.title}</h3>
          <p className="truncate text-sm text-sepia/80">{song.artist}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Tag tone="mustard">{song.bpm} BPM</Tag>
          <Tag tone="teal">orig. {song.scale}</Tag>
        </div>
      </header>
      <div className="flex flex-col gap-2 border-t border-dust/60 pt-3">
        <ChordRow label="Verse" chords={transpose(song.verseDegrees, displayScale)} />
        <ChordRow label="Chorus" chords={transpose(song.chorusDegrees, displayScale)} />
        {song.alternateVerseDegrees ? (
          <ChordRow label="Alt Verse" chords={transpose(song.alternateVerseDegrees, displayScale)} />
        ) : null}
        <ChordRow label="Bridge" chords={transpose(song.bridgeDegrees, displayScale)} />
      </div>
    </article>
  );
}
