import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { InvalidChordError, InvalidDegreeError, InvalidScaleError } from "@medleys/shared";

/** Base class for errors that map to a specific HTTP status. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(resource: string, id: string) {
    super(404, `${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

/** Wrap an async route handler so thrown/rejected errors reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

/** Central error middleware translating known error types into JSON responses. */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.flatten() });
    return;
  }
  if (
    err instanceof InvalidChordError ||
    err instanceof InvalidDegreeError ||
    err instanceof InvalidScaleError
  ) {
    res.status(400).json({ error: err.message });
    return;
  }
  req.log.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
