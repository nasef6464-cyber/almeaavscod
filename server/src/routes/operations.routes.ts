import { Router } from "express";
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
import { env } from "../config/env.js";

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
    const snapshots = await BackupSnapshotModel.find().sort({ createdAt: -1 }).limit(20);
    return res.json({ snapshots });
  }),
);
