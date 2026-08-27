import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "@medleys/shared";
import { Spinner } from "../components/atoms/Spinner.js";
import { Button } from "../components/atoms/Button.js";
import { SongCard } from "../components/molecules/SongCard.js";
import { Pagination } from "../components/molecules/Pagination.js";
import { SongFilterBar } from "../components/molecules/SongFilterBar.js";
import { SongForm } from "../components/organisms/SongForm.js";
import { SongImport } from "../components/organisms/SongImport.js";
import { useSongFacets, useSongList } from "../api/hooks.js";
import { useAuth } from "../api/useAuth.js";
import { useDebounced } from "../lib/useDebounced.js";

const PAGE_SIZE = 8;

export function SongsPage() {
  const [page, setPage] = useState(1);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [filters, setFilters] = useState({ q: "", artist: "", language: "" });
  const debouncedQ = useDebounced(filters.q);
  const applied = useMemo(
    () => ({ q: debouncedQ, artist: filters.artist, language: filters.language }),
    [debouncedQ, filters.artist, filters.language],
  );
  const hasFilters = applied.q !== "" || applied.artist !== "" || applied.language !== "";
  const { data, isLoading, isError, error } = useSongList(page, PAGE_SIZE, applied);
  const { data: facets } = useSongFacets();
  const { user } = useAuth();
  const canEdit = Boolean(user);
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (editingSong) {
      editorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [editingSong?.id]);

  useEffect(() => {
    setPage(1);
  }, [applied.q, applied.artist, applied.language]);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_minmax(320px,26rem)]">
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-3xl">Library</h1>
        <SongFilterBar
          q={filters.q}
          artist={filters.artist}
          language={filters.language}
          artists={facets?.artists ?? []}
          languages={facets?.languages ?? []}
          onChange={setFilters}
        />
        {isLoading ? <Spinner /> : null}
        {isError ? <p className="text-rust">{(error as Error).message}</p> : null}
        <div className="flex flex-col gap-3">
          {data?.items.map((song) => (
            <SongCard key={song.id} song={song} onEdit={setEditingSong} canEdit={canEdit} />
          ))}
          {data && data.items.length === 0 ? (
            <p className="text-sepia/70">
              {hasFilters ? "No songs match these filters." : "No songs yet — add your first one."}
            </p>
          ) : null}
        </div>
        {data && data.total > PAGE_SIZE ? (
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        ) : null}
      </section>

      {user ? (
        <section ref={editorRef} className="h-fit rounded-2xl border border-dust bg-cream/60 p-4 shadow-vinyl sm:p-6">
          {editingSong ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-display text-2xl">Edit song</h2>
                <Button type="button" variant="ghost" onClick={() => setEditingSong(null)}>
                  Cancel
                </Button>
              </div>
              <SongForm
                key={editingSong.id}
                song={editingSong}
                onSaved={() => {
                  setEditingSong(null);
                  setPage(1);
                }}
                onDeleted={() => {
                  setEditingSong(null);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <>
              <h2 className="mb-4 font-display text-2xl">Add a song</h2>
              <div className="mb-6 border-b border-dust pb-6">
                <SongImport onImported={() => setPage(1)} />
              </div>
              <SongForm onCreated={() => setPage(1)} />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
