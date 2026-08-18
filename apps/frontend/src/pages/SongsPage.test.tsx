import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Paginated, Song } from "@medleys/shared";
import { SongsPage } from "./SongsPage.js";
import { renderWithProviders } from "../test/utils.js";

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

function mockList(): void {
  const page: Paginated<Song> = { items: [SONG], total: 1, page: 1, pageSize: 8 };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(page), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SongsPage", () => {
  it("opens a pre-filled edit form when a song's Edit is clicked, and Cancel returns to Add", async () => {
    mockList();
    const user = userEvent.setup();
    renderWithProviders(<SongsPage />);

    // Default panel is the add-song form.
    expect(await screen.findByRole("form", { name: "Add song" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /edit cream sky/i }));

    const editForm = await screen.findByRole("form", { name: "Edit song" });
    expect(within(editForm).getByLabelText("Title")).toHaveValue("Cream Sky");
    expect(within(editForm).getByLabelText("Verse chords")).toHaveValue("C, G, Am, F");

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByRole("form", { name: "Add song" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Edit song" })).not.toBeInTheDocument();
  });
});
