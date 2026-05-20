import type { Request } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env.js";
import { createRedisClient, isRedisConfigured } from "../config/redis.js";

type RateLimitOptions = Pick<Options, "windowMs" | "limit" | "message"> & {
  keyPrefix: string;
  skip?: NonNullable<Options["skip"]>;
};

const resolveRequestKey = (req: Request) => {
  const authId = req.authUser?.id;
  if (authId) {
    return `user:${authId}`;
  }
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
};

const normalizeIp = (value: string) =>
  String(value || "")
    .trim()
    .replace(/^::ffff:/i, "");

const getRequestIp = (req: Request) => normalizeIp(req.ip || req.socket.remoteAddress || "");

const parseAdminBypassIps = () =>
  new Set(
    String(env.ADMIN_LOGIN_BYPASS_IPS || "")
      .split(",")
      .map((ip) => normalizeIp(ip))
      .filter(Boolean),
  );

const isAdminLoginBypassRequest = (req: Request) => {
  if (!env.ADMIN_LOGIN_BYPASS_ENABLED) return false;

  const bypassEmail = String(env.ADMIN_LOGIN_BYPASS_EMAIL || "").trim().toLowerCase();
  if (!bypassEmail) return false;

  const allowedIps = parseAdminBypassIps();
  if (allowedIps.size === 0) return false;

  const requestPath = String(req.originalUrl || req.path || "").toLowerCase();
  if (!requestPath.endsWith("/api/auth/login")) return false;

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const loginEmail = String((body as Record<string, unknown>).email || "").trim().toLowerCase();
  if (!loginEmail || loginEmail !== bypassEmail) return false;

  const requestIp = getRequestIp(req);
  return allowedIps.has(requestIp);
};

export function createRateLimiter(options: RateLimitOptions) {
  const redis = env.RATE_LIMIT_REDIS_ENABLED ? createRedisClient("rate-limit") : null;
  const useRedis = Boolean(redis && isRedisConfigured());

  if (!useRedis && env.NODE_ENV === "production") {
    console.warn(`[rate-limit] ${options.keyPrefix} is using in-memory limits because REDIS_URL is not configured`);
  }

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: resolveRequestKey,
    passOnStoreError: true,
    ...(options.skip ? { skip: options.skip } : {}),
    ...(useRedis && redis
      ? {
          store: new RedisStore({
            sendCommand: (...args: string[]) => (redis.call as (...commandArgs: string[]) => Promise<any>)(...args),
            prefix: `${env.REDIS_KEY_PREFIX}:rl:${options.keyPrefix}:`,
          }),
        }
      : {}),
    message: options.message,
  });
}

export const globalRateLimiter = createRateLimiter({
  keyPrefix: "global",
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  limit: env.RATE_LIMIT_GLOBAL_LIMIT,
  message: { message: "Too many requests, please try again shortly" },
  skip: (req) => {
    const path = req.path || "";
    const method = (req.method || "GET").toUpperCase();
    if (method !== "GET") return false;

    // Keep public health and bootstrap reads responsive under burst traffic.
    return (
      path === "/" ||
      path.startsWith("/api/health") ||
      path === "/api/content/bootstrap" ||
      path === "/api/taxonomy/bootstrap"
    );
  },
});

export const authRateLimiter = createRateLimiter({
  keyPrefix: "auth",
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  limit: env.RATE_LIMIT_AUTH_LIMIT,
  message: { message: "Too many authentication attempts, please try again later" },
  skip: isAdminLoginBypassRequest,
});

export const sensitiveActionRateLimiter = createRateLimiter({
  keyPrefix: "sensitive",
  windowMs: env.RATE_LIMIT_SENSITIVE_WINDOW_MS,
  limit: env.RATE_LIMIT_SENSITIVE_LIMIT,
  message: { message: "Too many requests, please slow down" },
});
