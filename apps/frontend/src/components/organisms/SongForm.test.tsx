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

describe("SongForm delete", () => {
  it("shows no Delete button in create mode", () => {
    renderWithProviders(<SongForm />);
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog on Delete without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} />);

    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));

    expect(screen.getByRole("heading", { name: /delete song\?/i })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("deletes and calls onDeleted when confirmed", async () => {
    const onDeleted = vi.fn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/songs\/s1$/);
    expect(init?.method).toBe("DELETE");
  });

  it("shows an inline error and does not call onDeleted when delete fails", async () => {
    const onDeleted = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/song not found/i);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("clears the inline error after Cancel following a failed delete", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SongForm song={SONG} />);

    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/song not found/i);

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
