import type { Song } from "@medleys/shared";
import { Link } from "react-router-dom";
import { Tag } from "../atoms/Tag.js";

/** Compact song summary used in search results and the songs list. */
export function SongCard({ song }: { song: Song }) {
  return (
    <Link
      to={`/chain/${song.id}`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-dust bg-cream/60 p-4 shadow-groove transition-colors hover:border-mustard hover:bg-parchment/70"
    >
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold group-hover:text-rust">{song.title}</h3>
        <p className="truncate text-sm text-sepia/80">{song.artist}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Tag tone="mustard">{song.bpm} BPM</Tag>
        <Tag tone="teal">{song.scale}</Tag>
        <Tag>{song.language}</Tag>
      </div>
    </Link>
  );
}
