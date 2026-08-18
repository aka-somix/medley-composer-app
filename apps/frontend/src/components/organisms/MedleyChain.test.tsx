import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
      verseSimilarity: 1,
      chorusSimilarity: 1,
      score: 1,
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
});
