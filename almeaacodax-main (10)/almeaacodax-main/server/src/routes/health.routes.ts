import { Router } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { getRedisHealth } from "../config/redis.js";

export const healthRouter = Router();

const serviceStartedAt = Date.now();

const readyStateLabels: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

function getDatabaseHealth() {
  const readyState = mongoose.connection.readyState;
  return {
    status: readyStateLabels[readyState] || "unknown",
    readyState,
    ok: readyState === 1,
  };
}

function getRuntimeHealth() {
  const commit =
    process.env.RENDER_GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    "";

  return {
    service: "The Hundred Platform API",
    environment: process.env.NODE_ENV || "development",
    version: process.env.APP_VERSION || process.env.npm_package_version || "0.1.0",
    commit: commit ? commit.slice(0, 12) : undefined,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(serviceStartedAt).toISOString(),
    timestamp: new Date().toISOString(),
  };
}

function isRedisRequiredForScale(featureEnabled: boolean) {
  return env.NODE_ENV === "production" && featureEnabled;
}

async function getDependencyHealth() {
  const database = getDatabaseHealth();
  const [rateLimitRedis, queueRedis] = await Promise.all([
    getRedisHealth("rate-limit", {
      required: isRedisRequiredForScale(env.RATE_LIMIT_REDIS_ENABLED),
    }),
    getRedisHealth("queue", {
      required: isRedisRequiredForScale(env.NOTIFICATION_QUEUE_ENABLED),
    }),
  ]);

  const checks = {
    database: database.ok ? "pass" : "fail",
    redisRateLimit: rateLimitRedis.ok ? "pass" : rateLimitRedis.required ? "fail" : "warn",
    redisQueue: queueRedis.ok ? "pass" : queueRedis.required ? "fail" : "warn",
  };
  const failedCriticalChecks = Object.values(checks).filter((status) => status === "fail").length;
  const warnings = Object.values(checks).filter((status) => status === "warn").length;

  return {
    status: failedCriticalChecks > 0 ? "degraded" : warnings > 0 ? "ready_with_warnings" : "ok",
    ok: failedCriticalChecks === 0,
    database,
    redis: {
      rateLimit: rateLimitRedis,
      queue: queueRedis,
    },
    checks,
    summary: {
      failedCriticalChecks,
      warnings,
      redisConfiguredForScale: rateLimitRedis.configured && queueRedis.configured,
    },
  };
}

healthRouter.get("/live", (_req, res) => {
  res.json({
    status: "ok",
    ...getRuntimeHealth(),
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const dependencies = await getDependencyHealth();
  const databaseReady = dependencies.database.ok;
  res.status(databaseReady ? 200 : 503).json({
    status: dependencies.status,
    ready: databaseReady,
    scaleReady: dependencies.summary.redisConfiguredForScale,
    database: dependencies.database,
    redis: dependencies.redis,
    checks: dependencies.checks,
    summary: dependencies.summary,
    ...getRuntimeHealth(),
  });
});

healthRouter.get("/scale-ready", async (_req, res) => {
  const dependencies = await getDependencyHealth();
  const scaleReady = dependencies.ok && dependencies.summary.redisConfiguredForScale;
  res.status(scaleReady ? 200 : 503).json({
    status: scaleReady ? "scale_ready" : "scale_blocked",
    ready: dependencies.database.ok,
    scaleReady,
    database: dependencies.database,
    redis: dependencies.redis,
    checks: dependencies.checks,
    summary: dependencies.summary,
    blockers: scaleReady
      ? []
      : [
          ...(!dependencies.database.ok ? ["mongodb_not_ready"] : []),
          ...(!dependencies.summary.redisConfiguredForScale ? ["redis_not_configured_for_multi_instance_scale"] : []),
        ],
    ...getRuntimeHealth(),
  });
});

healthRouter.get("/", async (_req, res) => {
  const dependencies = await getDependencyHealth();
  res.status(200).json({
    status: dependencies.ok ? dependencies.status : "live_with_dependency_warnings",
    ready: dependencies.ok,
    database: dependencies.database.status,
    redis: {
      rateLimit: dependencies.redis.rateLimit.status,
      queue: dependencies.redis.queue.status,
    },
    checks: dependencies.checks,
    summary: dependencies.summary,
    ...getRuntimeHealth(),
  });
});
