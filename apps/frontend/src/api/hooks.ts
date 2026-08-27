import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSongInput } from "@medleys/shared";
import { api, type SongFilters } from "./client.js";

export function useSongSearch(query: string) {
  return useQuery({
    queryKey: ["songs", "search", query],
    queryFn: () => api.searchSongs(query),
    enabled: query.trim().length > 0,
  });
}

export function useSongList(page: number, pageSize: number, filters?: SongFilters) {
  return useQuery({
    queryKey: ["songs", "list", page, pageSize, filters],
    queryFn: () => api.listSongs(page, pageSize, filters),
  });
}

export function useSongFacets() {
  return useQuery({
    queryKey: ["songs", "facets"],
    queryFn: () => api.getSongFacets(),
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

export function useImportSongs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songs: CreateSongInput[]) => api.importSongs(songs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}

export function useDeleteSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSong(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}
