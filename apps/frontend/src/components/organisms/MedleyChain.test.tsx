import { afterEach, describe, it, expect, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Song, Suggestion } from "@medleys/shared";
import { MedleyChain } from "./MedleyChain.js";
import { renderWithProviders } from "../../test/utils.js";

function song(overrides: Partial<Song>): Song {
  return {
    id: "s1",
    title: "Start",
    artist: "A",
    bpm: 120,
    scale: "C",
    language: "English",
    verseDegrees: ["1", "5", "6m", "4"],
    chorusDegrees: ["4", "1", "5", "6m"],
    bridgeDegrees: null,
    alternateVerseDegrees: null,
    createdAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MedleyChain", () => {
  it("shows a node with chords transposed to the display scale", () => {
    renderWithProviders(<MedleyChain chain={[song({})]} displayScale="D" onAppend={() => {}} />);
    // Verse degrees 1,5,6m,4 in D -> D, A, Bm, G (also appears in the chorus row)
    expect(screen.getAllByText("Bm").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
  });

  it("appends a picked suggestion", async () => {
    const next = song({ id: "s2", title: "Next Up" });
    const suggestion: Suggestion = {
      song: next,
      score: 1,
      bestMatch: { source: "verse", target: "verse", similarity: 1 },
      matches: [{ source: "verse", target: "verse", similarity: 1 }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([suggestion]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const onAppend = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<MedleyChain chain={[song({})]} displayScale="C" onAppend={onAppend} />);

    await user.click(screen.getByLabelText("Find a compatible next song"));
    const pick = await screen.findByRole("button", { name: /Next Up/ });
    await user.click(pick);

    await waitFor(() => expect(onAppend).toHaveBeenCalledWith(next));
  });

  it("shows a chip naming the suggested song's matched section", async () => {
    const next = song({ id: "s2", title: "Alt Match" });
    const suggestion: Suggestion = {
      song: next,
      score: 0.9,
      bestMatch: { source: "verse", target: "alternateVerse", similarity: 0.9 },
      matches: [{ source: "verse", target: "alternateVerse", similarity: 0.9 }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([suggestion]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<MedleyChain chain={[song({})]} displayScale="C" onAppend={() => {}} />);

    await user.click(screen.getByLabelText("Find a compatible next song"));
    await screen.findByRole("button", { name: /Alt Match/ });
    // "Alt Verse" appears only in the suggestion chip here (the chain song has no alt verse row).
    expect(screen.getByText("Alt Verse")).toBeInTheDocument();
  });

  it("renders an alternate verse row when the song has one", () => {
    renderWithProviders(
      <MedleyChain
        chain={[song({ alternateVerseDegrees: ["6m", "4", "1", "5"] })]}
        displayScale="C"
        onAppend={() => {}}
      />,
    );
    expect(screen.getByText("Alt Verse")).toBeInTheDocument();
  });

  it("has no remove button when only the starting song is in the chain", () => {
    renderWithProviders(
      <MedleyChain chain={[song({})]} displayScale="C" onAppend={() => {}} onRemoveLast={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /Remove .* from the chain/ })).not.toBeInTheDocument();
  });

  it("shows a remove button only on the last song, not the origin", () => {
    const start = song({ id: "s1", title: "Start" });
    const next = song({ id: "s2", title: "Next Up" });
    renderWithProviders(
      <MedleyChain chain={[start, next]} displayScale="C" onAppend={() => {}} onRemoveLast={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Remove Next Up from the chain" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Start from the chain" }),
    ).not.toBeInTheDocument();
  });

  it("wraps nodes into a boustrophedon grid once the container width is measured", () => {
    // Capture the ResizeObserver callback so we can drive a measurement pass.
    let trigger: (() => void) | undefined;
    class ResizeObserverMock {
      constructor(private cb: () => void) {
        trigger = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const chain = Array.from({ length: 6 }, (_, i) => song({ id: `s${i}`, title: `Song ${i}` }));
    const { container } = renderWithProviders(
      <MedleyChain chain={chain} displayScale="C" onAppend={() => {}} />,
    );

    const node = (i: number) => container.querySelector<HTMLElement>(`[data-node-index="${i}"]`)!;
    // Before measurement everything stacks in a single column (graceful fallback).
    expect(node(0).style.gridColumn).toBe("1");
    expect(node(1).style.gridColumn).toBe("1");

    // Stub layout: a container wide enough for exactly 2 cards per row (320px cards).
    const chainEl = screen.getByTestId("chain");
    Object.defineProperty(chainEl, "clientWidth", { value: 1000, configurable: true });
    node(0).getBoundingClientRect = () => ({ width: 320 }) as DOMRect;

    act(() => trigger?.());

    // perRow = 2. Even row reads left→right (cols 1,2); the next row reverses (cols 2,1),
    // so the chain turns down on the right and reads back left — a continuous snake.
    expect(node(0).style.gridColumn).toBe("1"); // row 0, pos 0
    expect(node(1).style.gridColumn).toBe("2"); // row 0, pos 1
    expect(node(2).style.gridColumn).toBe("2"); // row 1, pos 0 (reversed → right)
    expect(node(3).style.gridColumn).toBe("1"); // row 1, pos 1 (reversed → left)
    expect(node(0).style.gridRow).toBe("1");
    expect(node(2).style.gridRow).toBe("2");
    // Nothing is dropped when wrapping — every song is still rendered.
    for (let i = 0; i < 6; i++) {
      expect(screen.getByText(`Song ${i}`)).toBeInTheDocument();
    }
  });

  it("calls onRemoveLast when the last song's remove button is clicked", async () => {
    const start = song({ id: "s1", title: "Start" });
    const next = song({ id: "s2", title: "Next Up" });
    const onRemoveLast = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MedleyChain
        chain={[start, next]}
        displayScale="C"
        onAppend={() => {}}
        onRemoveLast={onRemoveLast}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove Next Up from the chain" }));
    expect(onRemoveLast).toHaveBeenCalledTimes(1);
  });
});
