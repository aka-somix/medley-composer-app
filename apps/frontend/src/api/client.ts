import type { CreateSongInput, Paginated, Song, Suggestion } from "@medleys/shared";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listSongs: (page: number, pageSize: number) =>
    request<Paginated<Song>>(`/api/songs?page=${page}&pageSize=${pageSize}`),
  searchSongs: (q: string) =>
    request<Song[]>(`/api/songs/search?q=${encodeURIComponent(q)}`),
  getSong: (id: string) => request<Song>(`/api/songs/${id}`),
  createSong: (input: CreateSongInput) =>
    request<Song>(`/api/songs`, { method: "POST", body: JSON.stringify(input) }),
  getSuggestions: (id: string) => request<Suggestion[]>(`/api/songs/${id}/suggestions`),
};
