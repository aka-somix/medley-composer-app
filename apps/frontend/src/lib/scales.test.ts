import { describe, it, expect } from "vitest";
import { transpose, SCALE_OPTIONS } from "./scales.js";

describe("transpose", () => {
  it("renders degree progressions in the chosen scale (spec example)", () => {
    expect(transpose(["1", "2m", "47"], "G")).toEqual(["G", "Am", "C7"]);
  });

  it("re-transposes the same degrees for a different scale", () => {
    expect(transpose(["1", "5", "6m", "4"], "C")).toEqual(["C", "G", "Am", "F"]);
    expect(transpose(["1", "5", "6m", "4"], "D")).toEqual(["D", "A", "Bm", "G"]);
  });

  it("returns an empty array for an absent section", () => {
    expect(transpose(null, "C")).toEqual([]);
    expect(transpose([], "C")).toEqual([]);
  });

  it("offers twelve display scales", () => {
    expect(SCALE_OPTIONS).toHaveLength(12);
  });
});
