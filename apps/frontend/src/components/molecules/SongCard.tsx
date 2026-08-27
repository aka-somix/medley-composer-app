import type { Song } from "@medleys/shared";
import { Link } from "react-router-dom";
import { Tag } from "../atoms/Tag.js";
import { Button } from "../atoms/Button.js";

/** Compact song summary used in search results and the songs list. */
export function SongCard({
  song,
  onEdit,
  canEdit = true,
}: {
  song: Song;
  onEdit?: (song: Song) => void;
  canEdit?: boolean;
}) {
  return (
    <div className="group flex flex-col gap-1.5 rounded-xl border border-dust bg-cream/60 p-4 shadow-groove transition-colors hover:border-mustard hover:bg-parchment/70 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <Link to={`/chain/${song.id}`} className="min-w-0 sm:flex-1">
        <h3 className="truncate text-lg font-semibold group-hover:text-rust">{song.title}</h3>
        <p className="truncate text-sm text-sepia/80">{song.artist}</p>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Tag tone="mustard">{song.bpm} BPM</Tag>
        <Tag tone="teal">{song.scale}</Tag>
        <Tag>{song.language}</Tag>
        {onEdit && canEdit ? (
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
