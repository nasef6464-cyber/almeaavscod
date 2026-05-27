import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { eq, desc, and, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth.js";
import { USE_PG } from "../utils/usePg.js";
import { db } from "../db/connection.js";

export const reviewRouter = Router();

reviewRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, courseId } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    res.json({ reviews: [], total: 0, page: Number(page), limit: Number(limit) });
  }),
);

reviewRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ courseId: z.string().min(1), rating: z.number().min(1).max(5), comment: z.string().optional() });
    const payload = schema.parse(req.body);
    res.status(StatusCodes.CREATED).json({ id: randomUUID(), ...payload, userId: req.authUser!.id, createdAt: new Date().toISOString() });
  }),
);

reviewRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(StatusCodes.NO_CONTENT).send();
  }),
);
