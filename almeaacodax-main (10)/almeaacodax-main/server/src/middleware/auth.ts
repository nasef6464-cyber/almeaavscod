import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../utils/authCookie.js";
import type { AppRole } from "../constants/roles.js";
import { UserModel } from "../models/User.js";

function resolveAuthUser(req: Request) {
  const raw = req.headers.authorization;
  const bearerToken = raw?.startsWith("Bearer ") ? raw.replace("Bearer ", "") : "";
  const cookieToken =
    typeof req.cookies?.[AUTH_COOKIE_NAME] === "string" ? String(req.cookies[AUTH_COOKIE_NAME]) : "";
  const token = bearerToken || cookieToken;

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
  if (env.DEV_LOCAL_ADMIN_BYPASS && env.NODE_ENV !== "production" && isStrictLocalRequest(req)) {
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
  if (env.DEV_LOCAL_ADMIN_BYPASS && env.NODE_ENV !== "production" && isStrictLocalRequest(req)) {
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
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: "Authentication required",
      });
    }

    try {
      if (env.DEV_LOCAL_ADMIN_BYPASS && env.NODE_ENV !== "production" && req.authUser.id === "local-dev-admin") {
        if (!allowedRoles.includes(req.authUser.role)) {
          return res.status(StatusCodes.FORBIDDEN).json({
            message: "You do not have access to this resource",
          });
        }
        return next();
      }

      const currentUser = await UserModel.findById(req.authUser.id).select("email name role isActive schoolId groupIds linkedStudentIds managedPathIds managedSubjectIds");
      if (!currentUser || currentUser.isActive === false) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          message: "Authentication required",
        });
      }

      req.authUser = {
        ...req.authUser,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role,
        schoolId: currentUser.schoolId || undefined,
        groupIds: Array.isArray(currentUser.groupIds) ? currentUser.groupIds.map(String) : [],
        linkedStudentIds: Array.isArray(currentUser.linkedStudentIds) ? currentUser.linkedStudentIds.map(String) : [],
        managedPathIds: Array.isArray(currentUser.managedPathIds) ? currentUser.managedPathIds.map(String) : [],
        managedSubjectIds: Array.isArray(currentUser.managedSubjectIds) ? currentUser.managedSubjectIds.map(String) : [],
      };

      const refreshedAuthUser = req.authUser;
      if (!refreshedAuthUser || !allowedRoles.includes(refreshedAuthUser.role)) {
        return res.status(StatusCodes.FORBIDDEN).json({
          message: "You do not have access to this resource",
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
