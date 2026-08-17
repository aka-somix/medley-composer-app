import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddSongForm } from "./AddSongForm.js";
import { renderWithProviders } from "../../test/utils.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AddSongForm", () => {
  it("submits raw chords and normalizes an empty bridge to null", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "new" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddSongForm />);

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
    });
    await screen.findByText("Song added.");
  });
});
