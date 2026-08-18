import { useLayoutEffect, useRef, useState } from "react";
import type { Song } from "@medleys/shared";
import { SongNode } from "./SongNode.js";
import { SuggestionPicker } from "./SuggestionPicker.js";

const COL_GAP = 48; // horizontal room for the connecting line between cards in a row (px)
const ROW_GAP = 44; // vertical room for the line where the snake turns to the next row (px)

type Segment = { x1: number; y1: number; x2: number; y2: number };

function sameSegments(a: Segment[], b: Segment[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => {
    const o = b[i]!;
    return s.x1 === o.x1 && s.y1 === o.y1 && s.x2 === o.x2 && s.y2 === o.y2;
  });
}

/**
 * Medley chain laid out as a boustrophedon "snake": cards fill a row, and when the next
 * card won't fit they wrap to a new row that reads in the opposite direction, so the
 * chain never overflows sideways. A strict grid (fixed columns) keeps every card aligned
 * to the same column across rows; odd rows place their cards right-to-left. An SVG overlay
 * measures the laid-out cards and draws one continuous line linking consecutive songs.
 * DOM order stays the chain order for screen readers — only the visual column flips.
 * Before measurement (SSR/tests) it degrades to a single vertical column.
 */
export function MedleyChain({
  chain,
  displayScale,
  onAppend,
  onRemoveLast,
}: {
  chain: Song[];
  displayScale: string;
  onAppend: (song: Song) => void;
  /** Removes the most recently added song. The origin song is never removable. */
  onRemoveLast?: () => void;
}) {
  const last = chain[chain.length - 1];
  const chainIds = chain.map((s) => s.id);
  // Every song, plus the "+" picker as the trailing node of the snake.
  const nodeCount = chain.length + (last ? 1 : 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [perRow, setPerRow] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);

  // How many fixed-width cards fit in one row. Re-measured whenever the container resizes.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const card = nodeRefs.current[0];
      const containerWidth = container.clientWidth;
      const cardWidth = card ? card.getBoundingClientRect().width : 0;
      if (!containerWidth || !cardWidth) {
        setPerRow(null);
      } else {
        const fit = Math.max(1, Math.floor((containerWidth + COL_GAP) / (cardWidth + COL_GAP)));
        setPerRow((prev) => (prev === fit ? prev : fit));
      }
      setTick((t) => t + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [nodeCount]);

  // After the grid is laid out, connect consecutive nodes edge-to-edge: a horizontal
  // segment across the gap for neighbours in a row, a vertical segment for a row turn.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || perRow === null) {
      setSegments((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const rects = nodeRefs.current
      .slice(0, nodeCount)
      .map((el) =>
        el ? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight } : null,
      );
    const next: Segment[] = [];
    for (let i = 0; i < rects.length - 1; i++) {
      const a = rects[i];
      const b = rects[i + 1];
      if (!a || !b) continue;
      const sameRow = Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2;
      if (sameRow) {
        const leftR = a.left <= b.left ? a : b;
        const rightR = a.left <= b.left ? b : a;
        const y = (a.top + a.height / 2 + (b.top + b.height / 2)) / 2;
        next.push({ x1: leftR.left + leftR.width, y1: y, x2: rightR.left, y2: y });
      } else {
        const topR = a.top <= b.top ? a : b;
        const botR = a.top <= b.top ? b : a;
        const x = (a.left + a.width / 2 + (b.left + b.width / 2)) / 2;
        next.push({ x1: x, y1: topR.top + topR.height, x2: x, y2: botR.top });
      }
    }
    setSegments((prev) => (sameSegments(prev, next) ? prev : next));
  }, [perRow, tick, nodeCount, displayScale]);

  const columns = perRow ?? 1;

  return (
    <div ref={containerRef} data-testid="chain" className="relative w-full overflow-hidden pb-4">
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-dust" aria-hidden>
        {segments.map((s, i) => (
          <line
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, max-content)`,
          columnGap: COL_GAP,
          rowGap: ROW_GAP,
          justifyContent: "start",
        }}
      >
        {Array.from({ length: nodeCount }).map((_, i) => {
          const row = Math.floor(i / columns);
          const posInRow = i % columns;
          // Even rows read left→right; odd rows right→left (the boustrophedon turn).
          const col = row % 2 === 0 ? posInRow : columns - 1 - posInRow;
          const isPicker = i === chain.length;
          return (
            <div
              key={isPicker ? "picker" : chain[i]!.id}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              data-testid={isPicker ? "chain-picker" : "chain-card"}
              data-node-index={i}
              // Cards stretch to fill the row height; the small "+" centers so it meets
              // the connecting line at the row's mid-height instead of floating at the top.
              className={`flex h-full justify-center ${isPicker ? "items-center" : ""}`}
              style={{ gridColumn: col + 1, gridRow: row + 1 }}
            >
              {isPicker ? (
                last ? <SuggestionPicker fromSong={last} excludeIds={chainIds} onPick={onAppend} /> : null
              ) : (
                <SongNode
                  song={chain[i]!}
                  displayScale={displayScale}
                  index={i}
                  onRemove={
                    onRemoveLast && i === chain.length - 1 && chain.length > 1 ? onRemoveLast : undefined
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
