import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotificationDeliveryModel } from "../models/NotificationDelivery.js";
import { NotificationTemplateModel } from "../models/NotificationTemplate.js";
import { enqueueNotificationDeliveries } from "../queues/notificationQueue.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";

export const notificationRouter = Router();

notificationRouter.get(
  "/templates",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    const templates = await NotificationTemplateModel.find().sort({ createdAt: -1 });
    return res.json({ templates });
  }),
);

notificationRouter.post(
  "/templates",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      channels: z.array(z.string()).default(["in_app"]),
      subjectTemplate: z.string().optional(),
      bodyTemplate: z.string().min(1),
      variables: z.array(z.string()).default([]),
      enabled: z.boolean().default(true),
    });
    const payload = schema.parse(req.body);
    const template = await NotificationTemplateModel.create(payload);
    return res.status(StatusCodes.CREATED).json(template);
  }),
);

notificationRouter.get(
  "/deliveries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, limit } = resolvePagination(req.query);
    const userId = req.authUser?.role === "admin" ? undefined : req.authUser?.id;
    const query = userId ? { userId } : {};
    const deliveries = await NotificationDeliveryModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await NotificationDeliveryModel.countDocuments(query);
    return res.json(buildPaginatedResponse(deliveries, page, limit, total));
  }),
);

notificationRouter.post(
  "/send",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      userIds: z.array(z.string()),
      channel: z.enum(["in_app", "email", "whatsapp", "sms"]).default("in_app"),
      title: z.string().min(1),
      body: z.string().min(1),
      templateCode: z.string().optional(),
    });
    const payload = schema.parse(req.body);
    const deliveries = payload.userIds.map((userId) => ({
      userId,
      channel: payload.channel,
      title: payload.title,
      body: payload.body,
      templateCode: payload.templateCode,
      status: "pending" as const,
    }));
    await NotificationDeliveryModel.insertMany(deliveries);
    await enqueueNotificationDeliveries(deliveries);
    return res.status(StatusCodes.CREATED).json({ sent: deliveries.length });
  }),
);
