/**
 * Chord <-> scale-degree translation, built on tonal.
 *
 * A chord symbol is split into a ROOT note (letter + accidentals) and an
 * opaque quality SUFFIX (e.g. "m", "7", "M7", "sus4", "m7b5"). The suffix is
 * preserved verbatim across translation; only the root moves.
 *
 * A degree token is [accidentals][single-digit 1-7][suffix], e.g. "2m", "4M7",
 * "b3", "#4sus4", "47" (= degree 4, dominant 7). Because the degree number is
 * always a single digit 1-7, the suffix boundary is unambiguous.
 */
import { Interval, Note } from "tonal";
import { InvalidChordError, InvalidDegreeError, InvalidScaleError } from "./errors.js";

const CHORD_RE = /^([A-Ga-g][#b]*)(.*)$/;
const DEGREE_RE = /^([#b]*)([1-7])(.*)$/;
const NOTE_RE = /^[A-Ga-g][#b]*$/;

/** Split a chord symbol into its root note and quality suffix. */
export function parseChordSymbol(chord: string): { root: string; suffix: string } {
  const match = CHORD_RE.exec(chord.trim());
  if (!match) throw new InvalidChordError(chord);
  const raw = match[1]!;
  const root = raw[0]!.toUpperCase() + raw.slice(1);
  return { root, suffix: match[2]! };
}

function assertValidScale(scaleRoot: string): string {
  const root = scaleRoot.trim();
  if (!NOTE_RE.test(root)) throw new InvalidScaleError(scaleRoot);
  return root[0]!.toUpperCase() + root.slice(1);
}

function accidentalString(alt: number): string {
  if (alt > 0) return "#".repeat(alt);
  if (alt < 0) return "b".repeat(-alt);
  return "";
}

function countAlteration(accidentals: string): number {
  let alt = 0;
  for (const ch of accidentals) alt += ch === "#" ? 1 : -1;
  return alt;
}

/** Build a tonal interval name (e.g. "4P", "2M", "3m", "4A") from degree + alt. */
function intervalName(num: number, alt: number): string {
  const isPerfect = num === 1 || num === 4 || num === 5;
  let quality: string;
  if (isPerfect) {
    if (alt === 0) quality = "P";
    else quality = alt > 0 ? "A".repeat(alt) : "d".repeat(-alt);
  } else {
    if (alt === 0) quality = "M";
    else if (alt === -1) quality = "m";
    else quality = alt > 0 ? "A".repeat(alt) : "d".repeat(-alt - 1);
  }
  return `${num}${quality}`;
}

/** Translate a single chord in the given scale to its degree token. */
export function chordToDegree(chord: string, scaleRoot: string): string {
  const root = assertValidScale(scaleRoot);
  const { root: chordRoot, suffix } = parseChordSymbol(chord);
  const iv = Interval.get(Interval.distance(root, chordRoot));
  if (iv.empty || iv.num == null || iv.alt == null) throw new InvalidChordError(chord);
  const simpleNum = ((iv.num - 1) % 7) + 1;
  return `${accidentalString(iv.alt)}${simpleNum}${suffix}`;
}

/** Translate a single degree token in the given scale back to a chord symbol. */
export function degreeToChord(degree: string, scaleRoot: string): string {
  const root = assertValidScale(scaleRoot);
  const match = DEGREE_RE.exec(degree.trim());
  if (!match) throw new InvalidDegreeError(degree);
  const alt = countAlteration(match[1]!);
  const num = Number.parseInt(match[2]!, 10);
  const suffix = match[3]!;
  const note = Note.transpose(root, intervalName(num, alt));
  if (!note) throw new InvalidDegreeError(degree);
  return `${note}${suffix}`;
}

/** Translate a progression of chords (in scaleRoot) to degree tokens. */
export function chordsToDegrees(chords: string[], scaleRoot: string): string[] {
  return chords.map((c) => chordToDegree(c, scaleRoot));
}

/** Translate a progression of degree tokens back to chords in scaleRoot. */
export function degreesToChords(degrees: string[], scaleRoot: string): string[] {
  return degrees.map((d) => degreeToChord(d, scaleRoot));
}

/** Parse a raw comma-separated progression string into trimmed, non-empty tokens. */
export function parseProgression(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Format a progression array back into a comma-separated display string. */
export function formatProgression(tokens: string[]): string {
  return tokens.join(", ");
}
