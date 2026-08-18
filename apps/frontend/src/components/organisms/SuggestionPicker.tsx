import { useState } from "react";
import type { Song, SongSection } from "@medleys/shared";
import { Spinner } from "../atoms/Spinner.js";
import { Tag } from "../atoms/Tag.js";
import { useSuggestions } from "../../api/hooks.js";

/** Chip text for the section of the suggested song that matched. */
const SECTION_LABEL: Record<SongSection, string> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  alternateVerse: "Alt Verse",
};

/**
 * The "+" edge at the end of the chain. Expands to show songs compatible with
 * `fromSong`; picking one appends it via onPick. Songs already in the chain are
 * excluded so the chain doesn't loop back on itself.
 */
export function SuggestionPicker({
  fromSong,
  excludeIds,
  onPick,
}: {
  fromSong: Song;
  excludeIds: string[];
  onPick: (song: Song) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, error } = useSuggestions(open ? fromSong.id : undefined);
  const suggestions = (data ?? []).filter((s) => !excludeIds.includes(s.song.id));

  return (
    <div className="flex shrink-0">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Find a compatible next song"
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-mustard text-2xl text-amber transition-colors hover:bg-mustard/10"
        >
          +
        </button>
      ) : (
        <div className="w-72 rounded-2xl border border-dust bg-parchment/70 p-4 shadow-vinyl sm:w-80">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-display text-lg">Compatible next</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-sepia/70 hover:text-rust"
              aria-label="Close suggestions"
            >
              ✕
            </button>
          </div>
          {isLoading ? <Spinner label="Finding matches…" /> : null}
          {isError ? (
            <p className="text-sm text-rust">{(error as Error).message}</p>
          ) : null}
          {!isLoading && !isError && suggestions.length === 0 ? (
            <p className="text-sm italic text-sepia/70">No compatible songs found.</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={s.song.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(s.song);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg border border-dust bg-cream/70 p-3 text-left transition-colors hover:border-mustard hover:bg-cream"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{s.song.title}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="sr-only">Matched on </span>
                      <Tag tone="neutral">{SECTION_LABEL[s.bestMatch.target]}</Tag>
                      <Tag tone="mustard">{Math.round(s.score * 100)}%</Tag>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-sepia/70">
                    <span className="truncate">{s.song.artist}</span>
                    <span>· {s.song.bpm} BPM</span>
                    <span>· {s.song.scale}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
