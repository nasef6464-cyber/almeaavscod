import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const message = error.message || "Internal server error";
  const statusCode = error.statusCode || error.status || 500;

  // Include underlying DB error details (Drizzle wraps PG errors in .cause or .detail)
  const detail = error.cause?.message || error.detail || error.hint || "";

  if (process.env.NODE_ENV !== "production") {
    console.error("[error]", message, detail ? "| detail:" + detail : "", error.stack?.split("\n")[1] || "");
  }

  res.status(statusCode).json({
    message,
    ...(detail ? { detail } : {}),
  });
}
