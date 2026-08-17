import { z } from "zod";

const noteRoot = z
  .string()
  .trim()
  .regex(/^[A-Ga-g][#b]*$/, "Scale must be a note root such as C, G, or F#");

/** Body schema for creating a song. Chords arrive raw; the service translates them. */
export const createSongSchema = z.object({
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1),
  bpm: z.number().int().positive().max(400),
  scale: noteRoot,
  language: z.string().trim().min(1),
  verseChords: z.string().trim().min(1),
  chorusChords: z.string().trim().min(1),
  bridgeChords: z.string().trim().nullish(),
});

/** Body schema for updating a song. All fields optional. */
export const updateSongSchema = createSongSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
});

export type CreateSongBody = z.infer<typeof createSongSchema>;
export type UpdateSongBody = z.infer<typeof updateSongSchema>;
