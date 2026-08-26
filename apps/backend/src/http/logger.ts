import type { RequestHandler } from "express";
import pino from "pino";
import pinoHttp from "pino-http";

const isProduction = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info");

export const logger = pino({
  level,
  ...(isProduction ? {} : { transport: { target: "pino-pretty" } }),
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Keep headers and bodies out of the logs — Authorization lives in there.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

/** Logs every request on arrival and again on completion (status + duration). */
export const requestLogger: RequestHandler[] = [
  httpLogger,
  (req, _res, next) => {
    req.log.info({ req }, "request received");
    next();
  },
];
