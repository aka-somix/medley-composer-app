import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Song } from "@medleys/shared";
import { Spinner } from "../components/atoms/Spinner.js";
import { Button } from "../components/atoms/Button.js";
import { ScaleSelector } from "../components/molecules/ScaleSelector.js";
import { MedleyChain } from "../components/organisms/MedleyChain.js";
import { useSong } from "../api/hooks.js";

export function ChainPage() {
  const { songId } = useParams<{ songId: string }>();
  const { data: startSong, isLoading, isError, error } = useSong(songId);

  const [chain, setChain] = useState<Song[]>([]);
  const [displayScale, setDisplayScale] = useState<string>("C");

  // Reset the chain whenever a new starting song is opened.
  useEffect(() => {
    if (startSong) {
      setChain([startSong]);
      setDisplayScale(startSong.scale);
    }
  }, [startSong]);

  const append = (song: Song) => setChain((prev) => [...prev, song]);
  const removeLast = () => setChain((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const reset = () => (startSong ? setChain([startSong]) : undefined);

  if (isLoading) return <Spinner label="Loading song…" />;
  if (isError) return <p className="text-rust">{(error as Error).message}</p>;
  if (!startSong || chain.length === 0) return <Spinner label="Preparing chain…" />;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-mustard">Medley from</p>
          <h1 className="font-display text-3xl">{startSong.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScaleSelector value={displayScale} onChange={setDisplayScale} />
          {chain.length > 1 ? (
            <Button variant="outline" onClick={reset}>
              Reset chain
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-sepia/70">
        {chain.length} song{chain.length > 1 ? "s" : ""} chained · chords shown in{" "}
        <span className="font-semibold">{displayScale}</span>. Tap{" "}
        <span className="font-mono text-amber">+</span> to extend from the last song.
      </p>

      <MedleyChain chain={chain} displayScale={displayScale} onAppend={append} onRemoveLast={removeLast} />

      <div>
        <Link to="/" className="text-sm text-teal underline-offset-2 hover:underline">
          ← Start a different medley
        </Link>
      </div>
    </section>
  );
}
