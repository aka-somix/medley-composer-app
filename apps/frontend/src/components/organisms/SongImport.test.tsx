import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BatchImportResult } from "@medleys/shared";
import { SongImport } from "./SongImport.js";
import { renderWithProviders } from "../../test/utils.js";

const ROWS = [
  {
    title: "First",
    artist: "A",
    bpm: 120,
    scale: "C",
    language: "English",
    verseChords: "C, G, Am, F",
    chorusChords: "F, C, G, Am",
  },
  {
    title: "Second",
    artist: "B",
    bpm: 98,
    scale: "G",
    language: "Italian",
    verseChords: "G, D, Em, C",
    chorusChords: "C, G, D, G",
  },
];

function jsonFile(value: unknown, name = "songs.json"): File {
  return new File([JSON.stringify(value)], name, { type: "application/json" });
}

function mockImportResponse(result: BatchImportResult) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SongImport", () => {
  it("uploads the parsed songs to the batch endpoint and reports the count", async () => {
    const fetchSpy = mockImportResponse({ created: [{}, {}] as never, errors: [] });
    const user = userEvent.setup();
    renderWithProviders(<SongImport />);

    await user.upload(screen.getByLabelText(/import songs from json file/i), jsonFile(ROWS));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("/api/songs/batch");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ songs: ROWS });

    await screen.findByText(/imported 2 songs/i);
  });

  it("reports skipped rows returned by the server", async () => {
    mockImportResponse({
      created: [{}] as never,
      errors: [{ row: 2, message: "Invalid chord: Zork" }],
    });
    const user = userEvent.setup();
    renderWithProviders(<SongImport />);

    await user.upload(screen.getByLabelText(/import songs from json file/i), jsonFile(ROWS));

    await screen.findByText(/imported 1 song/i);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/row 2/i);
    expect(alert).toHaveTextContent(/zork/i);
  });

  it("rejects a file that is not a JSON array without calling the API", async () => {
    const fetchSpy = mockImportResponse({ created: [], errors: [] });
    const user = userEvent.setup();
    renderWithProviders(<SongImport />);

    await user.upload(
      screen.getByLabelText(/import songs from json file/i),
      jsonFile({ not: "an array" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/array/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a file that is not valid JSON without calling the API", async () => {
    const fetchSpy = mockImportResponse({ created: [], errors: [] });
    const user = userEvent.setup();
    renderWithProviders(<SongImport />);

    const badFile = new File(["{ not json"], "songs.json", { type: "application/json" });
    await user.upload(screen.getByLabelText(/import songs from json file/i), badFile);

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid json/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
