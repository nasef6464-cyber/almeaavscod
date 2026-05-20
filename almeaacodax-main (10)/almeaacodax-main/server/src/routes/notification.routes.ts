import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { roles } from "../constants/roles.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotificationDeliveryModel } from "../models/NotificationDelivery.js";
import { NotificationTemplateModel } from "../models/NotificationTemplate.js";
import { enqueueNotificationDeliveries, enqueuePendingNotifications } from "../queues/notificationQueue.js";
import {
  createNotificationDeliveries,
  getNotificationBatchLimit,
  processPendingNotifications,
} from "../services/notificationService.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";

export const notificationRouter = Router();

const channelSchema = z.enum(["in_app", "email", "whatsapp"]);

const templateSchema = z.object({
  key: z.string().min(2).max(80).regex(/^[a-z0-9_.-]+$/i),
  name: z.string().min(2).max(160),
  channel: channelSchema.default("in_app"),
  subject: z.string().max(220).optional().default(""),
  title: z.string().min(2).max(220),
  body: z.string().min(2).max(4000),
  variables: z.array(z.string().min(1).max(80)).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

const sendNotificationSchema = z.object({
  templateKey: z.string().min(2).max(80).optional(),
  title: z.string().min(2).max(220).optional(),
  subject: z.string().max(220).optional(),
  body: z.string().min(2).max(4000).optional(),
  channels: z.array(channelSchema).min(1).max(3),
  userIds: z.array(z.string().min(1).max(120)).optional().default([]),
  roles: z.array(z.enum(roles)).optional().default([]),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
});

const processPendingSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(25),
});

const adminListSchema = z.object({
  status: z.enum(["pending", "sent", "failed", "retrying"]).optional(),
  channel: channelSchema.optional(),
});

notificationRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const pagination = resolvePagination(req.query, { limit: 50 });
    const filter = {
      recipientUserId: req.authUser!.id,
      channel: "in_app",
      status: "sent",
    };
    const [items, total] = await Promise.all([
      NotificationDeliveryModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      NotificationDeliveryModel.countDocuments(filter),
    ]);

    res.json({ notifications: items, pagination: buildPaginatedResponse([], pagination, total) });
  } catch (error) {
    next(error);
  }
});

notificationRouter.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const updated = await NotificationDeliveryModel.findOneAndUpdate(
      { id: req.params.id, recipientUserId: req.authUser!.id, channel: "in_app" },
      { $set: { readAt: Date.now() } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Notification not found" });
    }

    res.json({ notification: updated });
  } catch (error) {
    next(error);
  }
});

notificationRouter.get("/admin/templates", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const pagination = resolvePagination(_req.query, { limit: 50 });
    const [templates, total] = await Promise.all([
      NotificationTemplateModel.find().sort({ updatedAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      NotificationTemplateModel.countDocuments(),
    ]);
    res.json({ templates, pagination: buildPaginatedResponse([], pagination, total) });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post("/admin/templates", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const payload = templateSchema.parse(req.body);
    const template = await NotificationTemplateModel.findOneAndUpdate(
      { key: payload.key },
      {
        $set: {
          ...payload,
          updatedBy: req.authUser!.id,
        },
        $setOnInsert: {
          createdBy: req.authUser!.id,
        },
      },
      { new: true, upsert: true },
    ).lean();

    res.status(StatusCodes.CREATED).json({ template });
  } catch (error) {
    next(error);
  }
});

notificationRouter.get("/admin/deliveries", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const query = adminListSchema.parse(req.query);
    const pagination = resolvePagination(req.query, { limit: 50 });
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.channel) filter.channel = query.channel;

    const [deliveries, total, pendingCount, failedCount] = await Promise.all([
      NotificationDeliveryModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      NotificationDeliveryModel.countDocuments(filter),
      NotificationDeliveryModel.countDocuments({ status: { $in: ["pending", "retrying"] } }),
      NotificationDeliveryModel.countDocuments({ status: "failed" }),
    ]);

    res.json({ deliveries, pagination: buildPaginatedResponse([], pagination, total), summary: { pendingCount, failedCount } });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post("/admin/send", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const payload = sendNotificationSchema.parse(req.body);
    if (!payload.userIds.length && !payload.roles.length) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Select users or roles before sending" });
    }

    const result = await createNotificationDeliveries({
      templateKey: payload.templateKey,
      title: payload.title,
      subject: payload.subject,
      body: payload.body,
      channels: payload.channels,
      userIds: payload.userIds,
      roles: payload.roles,
      variables: payload.variables,
      createdBy: req.authUser!.id,
    });
    const queueResult = await enqueueNotificationDeliveries(result.deliveryIds || []);

    res.status(StatusCodes.ACCEPTED).json({
      ...result,
      queue: queueResult,
      maxRecipientsPerRequest: getNotificationBatchLimit(),
      message: queueResult.queued
        ? "Notification delivery records created and external deliveries queued."
        : "Notification delivery records created. External channels stay pending until Redis/BullMQ is configured or processed manually.",
    });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post("/admin/process-pending", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const payload = processPendingSchema.parse(req.body || {});
    const queueResult = await enqueuePendingNotifications(payload.limit);
    if (queueResult.queued) {
      return res.json({ mode: "queued", ...queueResult });
    }

    const result = await processPendingNotifications(payload.limit);
    res.json({ mode: "inline-fallback", ...result });
  } catch (error) {
    next(error);
  }
});
