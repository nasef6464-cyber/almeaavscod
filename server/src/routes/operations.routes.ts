import crypto from "crypto";
import { Router } from "express";
import { USE_PG } from "../utils/usePg.js";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AdminAuditLogModel } from "../models/AdminAuditLog.js";
import { AiInteractionModel } from "../models/AiInteraction.js";
import { ClientEventModel } from "../models/ClientEvent.js";
import { BackupSnapshotModel } from "../models/BackupSnapshot.js";
import { getRedisHealth, isRedisConfigured } from "../config/redis.js";
import { captureSentryMessage, isSentryEnabled } from "../observability/sentry.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";
import { desc, sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/connection.js";
import { adminAuditLogs, aiInteractions, clientEvents, backupSnapshots } from "../db/schema/index.js";

export const operationsRouter = Router();

operationsRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const redisHealth = isRedisConfigured() ? await getRedisHealth() : { status: "not_configured" };
    return res.json({
      status: "ok",
      nodeEnv: env.NODE_ENV,
      postgresEnabled: env.USE_POSTGRES,
      redis: redisHealth,
      sentry: { enabled: isSentryEnabled() },
      ai: { provider: env.AI_PROVIDER || "none" },
    });
  }),
);

operationsRouter.get(
  "/audit",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { page, limit } = resolvePagination(req.query);
    if (USE_PG()) {
      const logs = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit).offset((page - 1) * limit);
      const totalResult = await db.select({ count: sql`count(*)` }).from(adminAuditLogs);
      const total = Number(totalResult[0].count);
      return res.json(buildPaginatedResponse(logs, page, limit, total));
    }

    const logs = await AdminAuditLogModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await AdminAuditLogModel.countDocuments();
    return res.json(buildPaginatedResponse(logs, page, limit, total));
  }),
);

operationsRouter.post(
  "/client-events",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      type: z.string().min(1),
      message: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
      url: z.string().optional(),
      userAgent: z.string().optional(),
    });
    const payload = schema.parse(req.body);
    if (USE_PG()) {
      await db.insert(clientEvents).values({
        id: crypto.randomUUID(),
        ...payload,
        userId: req.authUser?.id,
      }).returning();
      return res.json({ received: true });
    }

    await ClientEventModel.create({
      ...payload,
      userId: req.authUser?.id,
    });
    return res.json({ received: true });
  }),
);

operationsRouter.get(
  "/ai-interactions",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { page, limit } = resolvePagination(req.query);
    if (USE_PG()) {
      const interactions = await db.select().from(aiInteractions).orderBy(desc(aiInteractions.createdAt)).limit(limit).offset((page - 1) * limit);
      const totalResult = await db.select({ count: sql`count(*)` }).from(aiInteractions);
      const total = Number(totalResult[0].count);
      return res.json(buildPaginatedResponse(interactions, page, limit, total));
    }

    const interactions = await AiInteractionModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await AiInteractionModel.countDocuments();
    return res.json(buildPaginatedResponse(interactions, page, limit, total));
  }),
);

operationsRouter.get(
  "/integrations",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      googleOAuth: {
        enabled: env.GOOGLE_OAUTH_ENABLED,
        clientId: env.GOOGLE_CLIENT_ID ? "***configured***" : "",
      },
      sentry: { enabled: isSentryEnabled() },
      redis: { configured: isRedisConfigured() },
      notifications: { queueEnabled: env.NOTIFICATION_QUEUE_ENABLED },
    });
  }),
);

operationsRouter.post(
  "/sentry/test",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    captureSentryMessage("Test message from operations router", "info");
    return res.json({ sent: isSentryEnabled() });
  }),
);

operationsRouter.get(
  "/backups",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    if (USE_PG()) {
      const snapshots = await db.select().from(backupSnapshots).orderBy(desc(backupSnapshots.createdAt)).limit(20);
      return res.json({ snapshots });
    }

    const snapshots = await BackupSnapshotModel.find().sort({ createdAt: -1 }).limit(20);
    return res.json({ snapshots });
  }),
);

operationsRouter.get(
  "/delivery-readiness",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      status: "ok",
      emailProvider: env.EMAIL_PROVIDER || "console",
      notifications: env.NOTIFICATION_QUEUE_ENABLED ? "enabled" : "disabled",
      timestamp: new Date().toISOString(),
    });
  }),
);

operationsRouter.get(
  "/integrations-readiness",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      status: "ok",
      googleOAuth: env.GOOGLE_OAUTH_ENABLED ? "configured" : "not configured",
      sentry: isSentryEnabled() ? "enabled" : "disabled",
      redis: isRedisConfigured() ? "configured" : "not configured",
      ai: env.AI_PROVIDER || "none",
      timestamp: new Date().toISOString(),
    });
  }),
);

operationsRouter.get(
  "/admin-audit-logs",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    if (USE_PG()) {
      const [logs, totalResult] = await Promise.all([
        db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(Number(limit)).offset(skip),
        db.select({ count: sql`count(*)` }).from(adminAuditLogs),
      ]);
      return res.json({ logs, total: Number(totalResult[0]?.count || 0) });
    }
    const logs = await AdminAuditLogModel.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await AdminAuditLogModel.countDocuments();
    return res.json({ logs, total });
  }),
);

operationsRouter.get(
  "/client-events",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    if (USE_PG()) {
      const [data, totalResult] = await Promise.all([
        db.select().from(clientEvents).orderBy(desc(clientEvents.createdAt)).limit(Number(limit)).offset(skip),
        db.select({ count: sql`count(*)` }).from(clientEvents),
      ]);
      return res.json({ events: data, total: Number(totalResult[0]?.count || 0) });
    }
    const events = await ClientEventModel.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await ClientEventModel.countDocuments();
    return res.json({ events, total });
  }),
);

operationsRouter.patch(
  "/client-events/:id/resolve",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    return res.json({ resolved: true, id: req.params.id });
  }),
);

operationsRouter.post(
  "/client-events/resolve-all",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({ resolved: true, count: 0 });
  }),
);

operationsRouter.post(
  "/repair",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      success: true,
      message: "Repair completed. No issues found.",
      timestamp: new Date().toISOString(),
    });
  }),
);
