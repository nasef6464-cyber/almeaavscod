import { Router } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { db } from "../db/connection.js";
import { getRedisHealth, isRedisConfigured } from "../config/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  if (env.USE_POSTGRES && env.DATABASE_URL) {
    let pgStatus = "disconnected";
    try {
      const pool = (db as any).session?.client || (db as any).pool;
      if (pool) {
        const r = await pool.query("SELECT 1");
        pgStatus = "connected";
      }
    } catch (e: any) {
      pgStatus = `error: ${(e.message || "").slice(0, 80)}`;
    }
    return res.status(200).json({
      status: "ok",
      database: `postgresql (${pgStatus})`,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(200).json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "mongodb (connected)" : "mongodb (disconnected)",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/live", async (_req, res) => {
  res.json({ status: "alive", timestamp: new Date().toISOString() });
});

healthRouter.get("/ready", async (_req, res) => {
  let dbReady = false;
  if (env.USE_POSTGRES && env.DATABASE_URL) {
    try {
      const pool = (db as any).session?.client || (db as any).pool;
      if (pool) {
        await pool.query("SELECT 1");
        dbReady = true;
      }
    } catch { /* not ready */ }
  } else {
    dbReady = mongoose.connection.readyState === 1;
  }

  if (dbReady) {
    return res.json({ status: "ready", database: "connected", timestamp: new Date().toISOString() });
  }
  res.status(503).json({ status: "not ready", database: "disconnected", timestamp: new Date().toISOString() });
});

healthRouter.get("/scale-ready", async (_req, res) => {
  let dbReady = false;
  if (env.USE_POSTGRES && env.DATABASE_URL) {
    try {
      const pool = (db as any).session?.client || (db as any).pool;
      if (pool) {
        await pool.query("SELECT 1");
        dbReady = true;
      }
    } catch { /* not ready */ }
  } else {
    dbReady = mongoose.connection.readyState === 1;
  }

  const redisHealth = await getRedisHealth();
  const redisConfiguredForScale = isRedisConfigured();
  const checks = {
    database: { ok: dbReady },
    redisRateLimit: { ok: redisHealth.status === "connected" || !redisConfiguredForScale },
    redisQueue: { ok: redisHealth.status === "connected" || !redisConfiguredForScale },
    redisConfiguredForScale: { ok: redisConfiguredForScale },
  };
  const allOk = Object.values(checks).every((c) => c.ok);

  const databaseReady = dbReady;
  const deps = {
    ok: allOk,
    checks,
    summary: {
      redisConfiguredForScale,
      message: redisConfiguredForScale ? "redis_configured_for_multi_instance_scale" : "redis_not_configured_for_multi_instance_scale",
    },
  };
  res.status(databaseReady ? 200 : 503).json({
    service: "The Hundred Platform API",
    ready: deps.ok,
    databaseReady,
    scaleReady: deps.summary.redisConfiguredForScale,
    dependencies: deps,
    gitCommit: process.env.RENDER_GIT_COMMIT || "unknown",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
