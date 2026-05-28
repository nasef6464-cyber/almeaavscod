import crypto from "crypto";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotificationDeliveryModel } from "../models/NotificationDelivery.js";
import { NotificationTemplateModel } from "../models/NotificationTemplate.js";
import { enqueueNotificationDeliveries } from "../queues/notificationQueue.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";
import { USE_PG } from "../utils/usePg.js";
import { db } from "../db/connection.js";
import { notificationTemplates, notificationDeliveries } from "../db/schema/index.js";
import { eq, and, desc, count } from "drizzle-orm";

export const notificationRouter = Router();

notificationRouter.get(
  "/templates",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    if (USE_PG()) {
      const templates = await db.select().from(notificationTemplates).orderBy(desc(notificationTemplates.createdAt));
      return res.json({ templates });
    }

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
    if (USE_PG()) {
      const [template] = await db.insert(notificationTemplates).values({ id: crypto.randomUUID(), ...payload, enabled: payload.enabled ? 1 : 0 }).returning();
      return res.status(StatusCodes.CREATED).json(template);
    }

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
    if (USE_PG()) {
      const conditions = userId ? [eq(notificationDeliveries.userId, userId)] : [];
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const deliveries = await db.select().from(notificationDeliveries).where(whereClause).orderBy(desc(notificationDeliveries.createdAt)).limit(limit).offset((page - 1) * limit);
      const [totalResult] = await db.select({ count: count() }).from(notificationDeliveries).where(whereClause);
      return res.json(buildPaginatedResponse(deliveries, page, limit, Number(totalResult.count)));
    }

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
    if (USE_PG()) {
      const deliveries = payload.userIds.map((userId) => ({
        id: crypto.randomUUID(),
        userId,
        channel: payload.channel,
        title: payload.title,
        body: payload.body,
        templateKey: payload.templateCode,
        status: "pending",
      }));
      const created = await db.insert(notificationDeliveries).values(deliveries).returning();
      await enqueueNotificationDeliveries(created);
      return res.status(StatusCodes.CREATED).json({ sent: created.length });
    }

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

notificationRouter.post(
  "/admin/test-delivery",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      channel: z.enum(["in_app", "email"]).default("in_app"),
      title: z.string().default("🧪 رسالة اختبارية"),
      body: z.string().default("هذه رسالة اختبارية من لوحة التحكم — تم إرسالها بنجاح ✅"),
    });
    const payload = schema.parse(req.body);
    const userId = req.authUser!.id;

    if (USE_PG()) {
      await db.insert(notificationDeliveries).values({
        id: crypto.randomUUID(),
        userId,
        channel: payload.channel,
        title: payload.title,
        body: payload.body,
        status: "sent",
        sentAt: new Date(),
      });
    } else {
      await NotificationDeliveryModel.create({
        userId,
        channel: payload.channel,
        title: payload.title,
        body: payload.body,
        status: "sent",
      });
    }

    return res.json({ success: true, message: "Test delivery created" });
  }),
);
