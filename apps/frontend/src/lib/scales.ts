import { degreesToChords } from "@medleys/shared";

/** Common major-key roots offered in the display-scale selector. */
export const SCALE_OPTIONS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/**
 * Transpose a stored degree progression into displayable chords for a scale.
 * Returns an empty array for a null/absent section (e.g. no bridge).
 * Falls back to the raw degree tokens if a token can't be transposed.
 */
export function transpose(degrees: string[] | null | undefined, scale: string): string[] {
  if (!degrees || degrees.length === 0) return [];
  try {
    return degreesToChords(degrees, scale);
  } catch {
    return degrees;
  }
}
