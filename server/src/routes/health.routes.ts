import { Router } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { db } from "../db/connection.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  if (env.USE_POSTGRES && env.DATABASE_URL) {
    let pgStatus = "disconnected";
    try {
      await db.execute({ raw: "SELECT 1" } as any);
      pgStatus = "connected";
    } catch (e: any) {
      pgStatus = `error: ${(e.message || "").slice(0, 60)}`;
    }
    return res.json({
      status: "ok",
      database: `postgresql (${pgStatus})`,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "mongodb (connected)" : "mongodb (disconnected)",
    timestamp: new Date().toISOString(),
  });
});
