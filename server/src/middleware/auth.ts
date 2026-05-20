import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { AppRole } from "../constants/roles.js";

export const AUTH_COOKIE_NAME = "almeaa_access_token";

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
}

function resolveAuthUser(req: Request) {
  let token: string | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "");
  }

  if (!token && req.cookies?.[AUTH_COOKIE_NAME]) {
    token = req.cookies[AUTH_COOKIE_NAME];
  }

  if (!token) return null;

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

function isStrictLocalRequest(req: Request) {
  const forwardedForHeader = req.headers["x-forwarded-for"];
  const forwardedFor = Array.isArray(forwardedForHeader)
    ? forwardedForHeader[0]
    : typeof forwardedForHeader === "string"
      ? forwardedForHeader.split(",")[0]?.trim()
      : "";
  const forwardedHostHeader = req.headers["x-forwarded-host"];
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : typeof forwardedHostHeader === "string"
      ? forwardedHostHeader.split(",")[0]?.trim()
      : "";
  const hostHeader = typeof req.headers.host === "string" ? req.headers.host.split(":")[0]?.trim() : "";
  const hostname = (req.hostname || "").trim();
  const ipCandidates = [req.ip || "", req.socket.remoteAddress || "", forwardedFor].map((value) => value.trim());
  const hostCandidates = [hostname, hostHeader, forwardedHost].map((value) => value.toLowerCase());

  const hasLoopbackIp = ipCandidates.some(
    (value) => value === "127.0.0.1" || value === "::1" || value.endsWith("127.0.0.1") || value.endsWith("::1"),
  );
  const hasLoopbackHost = hostCandidates.some((value) => value === "localhost" || value === "127.0.0.1" || value === "::1");

  return hasLoopbackIp && hasLoopbackHost;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (env.DEV_LOCAL_ADMIN_BYPASS && isStrictLocalRequest(req)) {
    req.authUser = {
      id: "local-dev-admin",
      email: env.ADMIN_EMAIL,
      role: "admin",
      name: env.ADMIN_NAME,
    };
    return next();
  }

  const authUser = resolveAuthUser(req);
  if (!authUser) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      message: "Authentication required",
    });
  }

  req.authUser = authUser;
  return next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (env.DEV_LOCAL_ADMIN_BYPASS && isStrictLocalRequest(req)) {
    req.authUser = {
      id: "local-dev-admin",
      email: env.ADMIN_EMAIL,
      role: "admin",
      name: env.ADMIN_NAME,
    };
    return next();
  }

  const authUser = resolveAuthUser(req);
  if (authUser) {
    req.authUser = authUser;
  }

  return next();
}

export function requireRole(allowedRoles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "You do not have access to this resource",
      });
    }

    return next();
  };
}
