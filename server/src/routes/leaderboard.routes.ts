import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { eq, desc, and, count } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalAuth } from "../middleware/auth.js";
import { USE_PG } from "../utils/usePg.js";
import { db } from "../db/connection.js";
import { users, quizResults } from "../db/schema/index.js";

export const leaderboardRouter = Router();

leaderboardRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { limit = 50, pathId } = req.query as any;

    if (USE_PG()) {
      const conditions = [];
      if (pathId) conditions.push(eq(users.managedPathIds, pathId));
      conditions.push(eq(users.isActive, true));

      const topUsers = await db.select({
        id: users.id,
        name: users.name,
        avatar: users.avatar,
        points: users.points,
        email: users.email,
      }).from(users).where(and(...conditions)).orderBy(desc(users.points)).limit(Number(limit));

      return res.json({ leaderboard: topUsers });
    }

    res.json({ leaderboard: [] });
  }),
);

leaderboardRouter.get(
  "/rank/:userId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json({ rank: 0, total: 0, userId: req.params.userId });
  }),
);
