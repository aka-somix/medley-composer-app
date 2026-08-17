import type { Song } from "@medleys/shared";
import { SongNode } from "./SongNode.js";
import { SuggestionPicker } from "./SuggestionPicker.js";

/** Horizontal, scrollable medley chain with a "+" edge to extend it. */
export function MedleyChain({
  chain,
  displayScale,
  onAppend,
}: {
  chain: Song[];
  displayScale: string;
  onAppend: (song: Song) => void;
}) {
  const last = chain[chain.length - 1];
  const chainIds = chain.map((s) => s.id);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-min items-stretch gap-4">
        {chain.map((song, index) => (
          <div key={song.id} className="flex items-stretch gap-4">
            {index > 0 ? <div className="mt-16 h-px w-8 shrink-0 self-start bg-dust sm:w-12" aria-hidden /> : null}
            <SongNode song={song} displayScale={displayScale} index={index} />
          </div>
        ))}
        {last ? <SuggestionPicker fromSong={last} excludeIds={chainIds} onPick={onAppend} /> : null}
      </div>
    </div>
  );
}
