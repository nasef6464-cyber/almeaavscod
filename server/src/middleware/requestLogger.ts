import type { NextFunction, Request, Response } from "express";

const DEFAULT_SLOW_REQUEST_LOG_MS = 1000;

function getSlowRequestThresholdMs() {
  const configured = Number(process.env.SLOW_REQUEST_LOG_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SLOW_REQUEST_LOG_MS;
}

function getRequestPath(req: Request) {
  return req.originalUrl.split("?")[0] || req.path;
}

function shouldSkipRoutineHealthLog(req: Request, statusCode: number, durationMs: number, slowThresholdMs: number) {
  const path = getRequestPath(req);
  const isHealthRoute = path === "/" || path === "/api/health" || path === "/api/health/" || path.startsWith("/api/health/");
  return isHealthRoute && statusCode < 500 && durationMs < slowThresholdMs && process.env.REQUEST_LOG_LEVEL !== "debug";
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const slowThresholdMs = getSlowRequestThresholdMs();
    const statusCode = res.statusCode;

    if (shouldSkipRoutineHealthLog(req, statusCode, durationMs, slowThresholdMs)) {
      return;
    }

    const isSlow = durationMs >= slowThresholdMs;
    const shouldLog = statusCode >= 400 || isSlow || process.env.REQUEST_LOG_LEVEL === "debug";

    if (!shouldLog) {
      return;
    }

    const authUser = req.authUser;
    const level = statusCode >= 500 ? "error" : isSlow ? "warn" : "info";
    const logLine = {
      level,
      event: "http_request",
      method: req.method,
      path: getRequestPath(req),
      statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      slowThresholdMs,
      requestId: req.requestId,
      userId: authUser?.id,
      role: authUser?.role,
      ip: req.ip,
    };

    const serialized = JSON.stringify(logLine);
    if (level === "error") {
      console.error(serialized);
      return;
    }
    if (level === "warn") {
      console.warn(serialized);
      return;
    }
    console.info(serialized);
  });

  next();
}
