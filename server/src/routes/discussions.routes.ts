import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { randomUUID } from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

export const discussionsRouter = Router();

discussionsRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, courseId, lessonId, search } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    res.json({ discussions: [], total: 0, page: Number(page), limit: Number(limit) });
  }),
);

discussionsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ title: z.string().min(1), body: z.string().min(1), courseId: z.string().optional(), lessonId: z.string().optional() });
    const payload = schema.parse(req.body);
    res.status(StatusCodes.CREATED).json({ id: randomUUID(), ...payload, userId: req.authUser!.id, createdAt: new Date().toISOString() });
  }),
);

discussionsRouter.post(
  "/:id/replies",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ body: z.string().min(1) });
    const payload = schema.parse(req.body);
    res.status(StatusCodes.CREATED).json({ id: randomUUID(), discussionId: req.params.id, ...payload, userId: req.authUser!.id, createdAt: new Date().toISOString() });
  }),
);

discussionsRouter.get(
  "/:id/replies",
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json({ replies: [] });
  }),
);
