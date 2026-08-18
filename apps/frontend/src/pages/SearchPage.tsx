import { useState } from "react";
import { Input } from "../components/atoms/Input.js";
import { Spinner } from "../components/atoms/Spinner.js";
import { SongCard } from "../components/molecules/SongCard.js";
import { useSongSearch } from "../api/hooks.js";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, error } = useSongSearch(query);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-4xl sm:text-5xl">Find your next medley</h1>
        <p className="mt-2 text-sepia/80">Search a song, then chain compatible tracks by their chord progressions.</p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <Input
          type="search"
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search songs by title"
          className="text-lg"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? <Spinner label="Searching…" /> : null}
        {isError ? <p className="text-rust">{(error as Error).message}</p> : null}
        {query.trim() && !isLoading && data?.length === 0 ? (
          <p className="text-center text-sepia/70">No songs match “{query}”.</p>
        ) : null}
        {data?.map((song) => <SongCard key={song.id} song={song} />)}
      </div>
    </section>
  );
}
