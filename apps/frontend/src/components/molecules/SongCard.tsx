import type { Song } from "@medleys/shared";
import { Link } from "react-router-dom";
import { Tag } from "../atoms/Tag.js";
import { Button } from "../atoms/Button.js";

/** Compact song summary used in search results and the songs list. */
export function SongCard({ song, onEdit }: { song: Song; onEdit?: (song: Song) => void }) {
  return (
    <div className="group flex items-center justify-between gap-4 rounded-xl border border-dust bg-cream/60 p-4 shadow-groove transition-colors hover:border-mustard hover:bg-parchment/70">
      <Link to={`/chain/${song.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold group-hover:text-rust">{song.title}</h3>
          <p className="truncate text-sm text-sepia/80">{song.artist}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <Tag tone="mustard">{song.bpm} BPM</Tag>
        <Tag tone="teal">{song.scale}</Tag>
        <Tag>{song.language}</Tag>
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            className="px-3 py-1.5"
            aria-label={`Edit ${song.title}`}
            onClick={() => onEdit(song)}
          >
            Edit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
