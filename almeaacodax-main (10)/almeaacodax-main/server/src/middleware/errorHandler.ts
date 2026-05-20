import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { captureSentryException, isSentryEnabled } from "../observability/sentry.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: "Route not found",
    requestId: req.requestId,
  });
}

export function errorHandler(
  error: Error & { statusCode?: number; status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const isProduction = process.env.NODE_ENV === "production";
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid request payload",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      requestId: _req.requestId,
    });
  }

  const statusCode = error.statusCode || error.status || 500;
  const message = statusCode >= 500 && isProduction ? "Internal server error" : error.message || "Internal server error";

  if (statusCode >= 500 && isSentryEnabled()) {
    captureSentryException(error, {
      requestId: _req.requestId,
      method: _req.method,
      path: _req.originalUrl || _req.url,
      statusCode,
      userId: _req.authUser?.id || "",
      role: _req.authUser?.role || "",
    });
  }

  res.status(statusCode).json({
    message,
    requestId: _req.requestId,
  });
}
