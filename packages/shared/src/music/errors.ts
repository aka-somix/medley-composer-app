/** Thrown when a chord symbol cannot be parsed (e.g. "H7", "xyz"). */
export class InvalidChordError extends Error {
  constructor(public readonly value: string) {
    super(`Invalid chord symbol: "${value}"`);
    this.name = "InvalidChordError";
  }
}

/** Thrown when a degree token cannot be parsed (e.g. "9", "x"). */
export class InvalidDegreeError extends Error {
  constructor(public readonly value: string) {
    super(`Invalid degree token: "${value}"`);
    this.name = "InvalidDegreeError";
  }
}

/** Thrown when a scale root note cannot be parsed (e.g. "H", "Q"). */
export class InvalidScaleError extends Error {
  constructor(public readonly value: string) {
    super(`Invalid scale root: "${value}"`);
    this.name = "InvalidScaleError";
  }
}
