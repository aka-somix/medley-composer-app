/**
 * Sequence-alignment similarity for degree progressions.
 *
 * similarity = 1 - levenshtein(a, b) / max(len(a), len(b))
 *
 * Order-sensitive: a progression is an ordered sequence of chords, and the
 * Levenshtein edit distance counts insertions/deletions/substitutions needed
 * to turn one sequence into the other. Two empty progressions are identical.
 */

/** Levenshtein edit distance between two token arrays. */
export function levenshtein(a: readonly string[], b: readonly string[]): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1, // deletion
        curr[j - 1]! + 1, // insertion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** Normalized similarity in [0, 1] between two degree progressions. */
export function progressionSimilarity(a: readonly string[], b: readonly string[]): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}
