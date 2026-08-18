import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSongInput } from "@medleys/shared";
import { api } from "./client.js";

export function useSongSearch(query: string) {
  return useQuery({
    queryKey: ["songs", "search", query],
    queryFn: () => api.searchSongs(query),
    enabled: query.trim().length > 0,
  });
}

export function useSongList(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["songs", "list", page, pageSize],
    queryFn: () => api.listSongs(page, pageSize),
  });
}

export function useSong(id: string | undefined) {
  return useQuery({
    queryKey: ["songs", "detail", id],
    queryFn: () => api.getSong(id!),
    enabled: Boolean(id),
  });
}

export function useSuggestions(id: string | undefined) {
  return useQuery({
    queryKey: ["songs", "suggestions", id],
    queryFn: () => api.getSuggestions(id!),
    enabled: Boolean(id),
  });
}

export function useCreateSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSongInput) => api.createSong(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}

export function useUpdateSong(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSongInput) => api.updateSong(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}
