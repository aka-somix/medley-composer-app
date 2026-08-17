import { describe, it, expect } from "vitest";
import {
  chordToDegree,
  degreeToChord,
  chordsToDegrees,
  degreesToChords,
  parseChordSymbol,
  parseProgression,
} from "./chords.js";
import { InvalidChordError, InvalidDegreeError, InvalidScaleError } from "./errors.js";

describe("parseChordSymbol", () => {
  it("splits root and suffix, normalizing root case", () => {
    expect(parseChordSymbol("C")).toEqual({ root: "C", suffix: "" });
    expect(parseChordSymbol("Dm")).toEqual({ root: "D", suffix: "m" });
    expect(parseChordSymbol("f#m7")).toEqual({ root: "F#", suffix: "m7" });
    expect(parseChordSymbol("Bb7")).toEqual({ root: "Bb", suffix: "7" });
  });

  it("throws on invalid chords", () => {
    expect(() => parseChordSymbol("H7")).toThrow(InvalidChordError);
  });
});

describe("chordsToDegrees (spec examples)", () => {
  it("translates C,G,Dm,FM7 in C to 1,5,2m,4M7", () => {
    expect(chordsToDegrees(["C", "G", "Dm", "FM7"], "C")).toEqual(["1", "5", "2m", "4M7"]);
  });

  it("keeps the quality suffix and folds the octave", () => {
    expect(chordToDegree("A7", "C")).toBe("67");
    expect(chordToDegree("Bm7", "C")).toBe("7m7");
  });

  it("marks non-diatonic roots with accidentals", () => {
    expect(chordToDegree("F#", "C")).toBe("#4");
    expect(chordToDegree("Eb", "C")).toBe("b3");
    expect(chordToDegree("Bb", "C")).toBe("b7");
  });
});

describe("degreesToChords (spec examples)", () => {
  it("translates 1,2m,47 in G to G,Am,C7", () => {
    expect(degreesToChords(["1", "2m", "47"], "G")).toEqual(["G", "Am", "C7"]);
  });

  it("resolves accidental degrees", () => {
    expect(degreeToChord("#4", "C")).toBe("F#");
    expect(degreeToChord("b3", "C")).toBe("Eb");
    expect(degreeToChord("b7", "C")).toBe("Bb");
  });
});

describe("round-trip property", () => {
  const cases: Array<{ chords: string[]; scale: string }> = [
    { chords: ["C", "G", "Dm", "FM7"], scale: "C" },
    { chords: ["G", "Am", "C7", "D7"], scale: "G" },
    { chords: ["F#", "F#m7", "B", "C#7"], scale: "A" },
    { chords: ["Bb", "Eb", "F7", "Gm"], scale: "Bb" },
    { chords: ["Csus4", "Fsus2", "Gadd9"], scale: "C" },
  ];

  for (const { chords, scale } of cases) {
    it(`${chords.join(",")} in ${scale} survives a round trip`, () => {
      const degrees = chordsToDegrees(chords, scale);
      expect(degreesToChords(degrees, scale)).toEqual(chords);
    });
  }
});

describe("error handling", () => {
  it("throws InvalidScaleError on bad scale root", () => {
    expect(() => chordToDegree("C", "H")).toThrow(InvalidScaleError);
  });

  it("throws InvalidDegreeError on bad degree token", () => {
    expect(() => degreeToChord("9", "C")).toThrow(InvalidDegreeError);
    expect(() => degreeToChord("x", "C")).toThrow(InvalidDegreeError);
  });
});

describe("parseProgression", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseProgression("C, G ,, Dm ,")).toEqual(["C", "G", "Dm"]);
  });
});
