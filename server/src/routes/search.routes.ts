import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { eq, desc, and, or, ilike, count } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalAuth } from "../middleware/auth.js";
import { USE_PG } from "../utils/usePg.js";
import { db } from "../db/connection.js";
import { courses, lessons, questions } from "../db/schema/index.js";

export const searchRouter = Router();

searchRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { q, type = "all", page = 1, limit = 20 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    if (!q || String(q).trim().length === 0) {
      return res.json({ results: [], total: 0 });
    }

    const query = String(q).trim();
    const results: any[] = [];

    if (USE_PG()) {
      if (type === "all" || type === "courses") {
        const courseResults = await db.select({ id: courses.id, title: courses.title, thumbnail: courses.thumbnail })
          .from(courses).where(and(ilike(courses.title, `%${query}%`), eq(courses.isPublished, true))).limit(Number(limit));
        results.push(...courseResults.map((r) => ({ ...r, _type: "course" })));
      }
      if (type === "all" || type === "lessons") {
        const lessonResults = await db.select({ id: lessons.id, title: lessons.title })
          .from(lessons).where(and(ilike(lessons.title, `%${query}%`), eq(lessons.showOnPlatform, true))).limit(Number(limit));
        results.push(...lessonResults.map((r) => ({ ...r, _type: "lesson" })));
      }
      if (type === "all" || type === "questions") {
        const questionResults = await db.select({ id: questions.id, text: questions.text })
          .from(questions).where(ilike(questions.text, `%${query}%`)).limit(Number(limit));
        results.push(...questionResults.map((r) => ({ ...r, _type: "question" })));
      }

      return res.json({ results, total: results.length });
    }

    res.json({ results: [], total: 0 });
  }),
);
