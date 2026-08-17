import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Songs table. Chord progressions are stored as canonical scale-degree token
 * arrays (JSON), not raw chords, so comparison and transposition stay
 * key-independent. `scale` retains the original key for ranking.
 */
export const songs = sqliteTable("songs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  bpm: integer("bpm").notNull(),
  scale: text("scale").notNull(),
  language: text("language").notNull(),
  verseDegrees: text("verse_degrees", { mode: "json" }).notNull().$type<string[]>(),
  chorusDegrees: text("chorus_degrees", { mode: "json" }).notNull().$type<string[]>(),
  bridgeDegrees: text("bridge_degrees", { mode: "json" }).$type<string[] | null>(),
  createdAt: text("created_at").notNull(),
});

export type SongRow = typeof songs.$inferSelect;
export type SongInsert = typeof songs.$inferInsert;
