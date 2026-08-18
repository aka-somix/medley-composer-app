import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Song } from "@medleys/shared";
import { SongForm } from "./SongForm.js";
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

describe("SongForm", () => {
  it("submits raw chords and normalizes an empty bridge to null", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "new" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SongForm />);

    await user.type(screen.getByLabelText("Title"), "Cream Sky");
    await user.type(screen.getByLabelText("Artist"), "The Grooves");
    await user.type(screen.getByLabelText("Verse chords"), "C, G, Am, F");
    await user.type(screen.getByLabelText("Chorus chords"), "F, C, G, Am");
    await user.click(screen.getByRole("button", { name: /add song/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      title: "Cream Sky",
      artist: "The Grooves",
      verseChords: "C, G, Am, F",
      chorusChords: "F, C, G, Am",
      bridgeChords: null,
      alternateVerseChords: null,
    });
    await screen.findByText("Song added.");
  });

  it("pre-fills from a song and saves changes with PUT", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...SONG, title: "Cream Sky (Live)" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} />);

    // Chords are shown transposed back into the song's own scale.
    expect(screen.getByLabelText("Title")).toHaveValue("Cream Sky");
    expect(screen.getByLabelText("Verse chords")).toHaveValue("C, G, Am, F");
    expect(screen.getByLabelText("Chorus chords")).toHaveValue("F, C, G, Am");
    expect(screen.getByLabelText("Bridge chords (optional)")).toHaveValue("");
    expect(screen.getByLabelText("Alt Verse chords (optional)")).toHaveValue("");

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Cream Sky (Live)");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("/api/songs/s1");
    expect((init as RequestInit).method).toBe("PUT");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      title: "Cream Sky (Live)",
      artist: "The Grooves",
      verseChords: "C, G, Am, F",
      chorusChords: "F, C, G, Am",
    });
  });

  it("submits an alternate verse when provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "new" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SongForm />);

    await user.type(screen.getByLabelText("Title"), "Alt Song");
    await user.type(screen.getByLabelText("Artist"), "A");
    await user.type(screen.getByLabelText("Verse chords"), "C, G, Am, F");
    await user.type(screen.getByLabelText("Chorus chords"), "F, C, G, Am");
    await user.type(screen.getByLabelText("Alt Verse chords (optional)"), "Am, F, C, G");
    await user.click(screen.getByRole("button", { name: /add song/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.alternateVerseChords).toBe("Am, F, C, G");
  });
});
