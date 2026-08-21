import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Paginated, Song } from "@medleys/shared";
import { SongsPage } from "./SongsPage.js";
import { renderWithProviders } from "../test/utils.js";
import * as auth from "../api/useAuth.js";

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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.spyOn(auth, "useAuth").mockReturnValue({
    user: { email: "friend@gmail.com" },
    token: "t",
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SongsPage delete flow", () => {
  it("closes the edit panel back to 'Add a song' after a confirmed delete", async () => {
    const list: Paginated<Song> = { items: [SONG], total: 1, page: 1, pageSize: 8 };
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(jsonResponse(list));
    });
    const user = userEvent.setup();
    renderWithProviders(<SongsPage />);

    // Enter edit mode from the song card.
    await user.click(await screen.findByRole("button", { name: /edit cream sky/i }));
    expect(screen.getByRole("heading", { name: /edit song/i })).toBeInTheDocument();

    // Delete → confirm.
    await user.click(screen.getByRole("button", { name: /delete cream sky/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    // Panel returns to "Add a song".
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /add a song/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("heading", { name: /edit song/i })).not.toBeInTheDocument();
  });
});

describe("SongsPage auth gating", () => {
  const list: Paginated<Song> = { items: [SONG], total: 1, page: 1, pageSize: 8 };

  it("hides the add-song form and edit affordance when signed out", async () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: null, token: null, signIn: vi.fn(), signOut: vi.fn() });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(list));
    renderWithProviders(<SongsPage />);

    await screen.findByText("Cream Sky");
    expect(screen.queryByRole("button", { name: /add song/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit cream sky/i })).not.toBeInTheDocument();
  });

  it("shows the add-song form and edit affordance when signed in", async () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { email: "friend@gmail.com" },
      token: "t",
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(list));
    renderWithProviders(<SongsPage />);

    await screen.findByText("Cream Sky");
    expect(screen.getByRole("button", { name: /add song/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit cream sky/i })).toBeInTheDocument();
  });
});
