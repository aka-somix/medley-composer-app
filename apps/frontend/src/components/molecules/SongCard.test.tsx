import { afterEach, describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Song } from "@medleys/shared";
import { SongCard } from "./SongCard.js";
import { renderWithProviders } from "../../test/utils.js";

const SONG: Song = {
  id: "s1",
  title: "Cream Sky",
  artist: "The Grooves",
  bpm: 96,
  scale: "C",
  language: "English",
  verseDegrees: ["1", "5", "6m", "4"],
  chorusDegrees: ["4", "1", "5", "6m"],
  bridgeDegrees: null,
  alternateVerseDegrees: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SongCard", () => {
  it("calls onEdit with the song when the edit control is clicked", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SongCard song={SONG} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: /edit cream sky/i }));

    expect(onEdit).toHaveBeenCalledWith(SONG);
  });

  it("still links to the song's chain page", () => {
    renderWithProviders(<SongCard song={SONG} onEdit={() => {}} />);
    expect(screen.getByRole("link", { name: /cream sky/i })).toHaveAttribute(
      "href",
      "/chain/s1",
    );
  });
});
