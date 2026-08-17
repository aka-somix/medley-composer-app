import { useState } from "react";
import { Spinner } from "../components/atoms/Spinner.js";
import { SongCard } from "../components/molecules/SongCard.js";
import { Pagination } from "../components/molecules/Pagination.js";
import { AddSongForm } from "../components/organisms/AddSongForm.js";
import { useSongList } from "../api/hooks.js";

const PAGE_SIZE = 8;

export function SongsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useSongList(page, PAGE_SIZE);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_minmax(320px,26rem)]">
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-3xl">Library</h1>
        {isLoading ? <Spinner /> : null}
        {isError ? <p className="text-rust">{(error as Error).message}</p> : null}
        <div className="flex flex-col gap-3">
          {data?.items.map((song) => <SongCard key={song.id} song={song} />)}
          {data && data.items.length === 0 ? (
            <p className="text-sepia/70">No songs yet — add your first one.</p>
          ) : null}
        </div>
        {data && data.total > PAGE_SIZE ? (
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        ) : null}
      </section>

      <section className="h-fit rounded-2xl border border-dust bg-cream/60 p-6 shadow-vinyl">
        <h2 className="mb-4 font-display text-2xl">Add a song</h2>
        <AddSongForm onCreated={() => setPage(1)} />
      </section>
    </div>
  );
}
