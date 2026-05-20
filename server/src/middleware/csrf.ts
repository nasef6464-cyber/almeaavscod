import type { Request, Response, NextFunction } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const CSRF_COOKIE_NAME = "almeaa_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_BYTES = 32;
const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const csrfCookieOptions = {
  httpOnly: false,
  path: "/",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  secure: env.NODE_ENV === "production",
} as const;

function createCsrfToken() {
  return randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
}

function safeTokenEquals(left: string, right: string) {
  try {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export function issueCsrfToken(res: Response) {
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
  return token;
}

export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (CSRF_SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const cookieToken = typeof req.cookies?.[CSRF_COOKIE_NAME] === "string" ? req.cookies[CSRF_COOKIE_NAME] : "";
  const headerToken = typeof req.header(CSRF_HEADER_NAME) === "string" ? req.header(CSRF_HEADER_NAME) : "";

  if (!cookieToken || !headerToken || !safeTokenEquals(cookieToken, headerToken)) {
    return res.status(403).json({
      message: "Invalid CSRF token",
      code: "CSRF_TOKEN_INVALID",
    });
  }

  return next();
}
