import { afterEach, describe, it, expect, vi } from "vitest";
import { api } from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api.deleteSong", () => {
  it("issues a DELETE to /api/songs/:id and resolves undefined on 204", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const result = await api.deleteSong("s1");

    expect(result).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/songs\/s1$/);
    expect(init?.method).toBe("DELETE");
  });

  it("throws with the server error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.deleteSong("nope")).rejects.toThrow("Song not found");
  });
});
