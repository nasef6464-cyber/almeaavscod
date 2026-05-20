import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { QuizResultModel } from "../models/QuizResult.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const quizResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20).transform((value) => Math.min(value, 100)),
  search: z.string().trim().max(120).optional(),
  quizId: z.string().trim().max(120).optional(),
  studentId: z.string().trim().max(120).optional(),
  status: z.enum(["passed", "failed"]).optional(),
  dateFrom: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Invalid dateFrom"),
  dateTo: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Invalid dateTo"),
  sortBy: z.enum(["createdAt", "score", "quizTitle", "date"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPaginationPayload = (page: number, limit: number, total: number) => {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

const buildResultProjection =
  "id userId quizId quizTitle score passed attemptNumber source totalQuestions correctAnswers wrongAnswers unanswered timeSpentSeconds timeSpent date skillsAnalysis createdAt updatedAt";

const buildFilter = (query: z.infer<typeof quizResultsQuerySchema>, userId?: string) => {
  const filter: Record<string, unknown> = {};
  if (userId) {
    filter.userId = userId;
  }
  if (query.quizId) {
    filter.quizId = query.quizId;
  }
  if (query.status) {
    filter.passed = query.status === "passed";
  }
  if (query.search) {
    filter.quizTitle = { $regex: escapeRegex(query.search), $options: "i" };
  }
  if (query.studentId && !userId) {
    filter.userId = query.studentId;
  }

  const createdAt: Record<string, Date> = {};
  if (query.dateFrom) {
    createdAt.$gte = new Date(query.dateFrom);
  }
  if (query.dateTo) {
    createdAt.$lte = new Date(query.dateTo);
  }
  if (Object.keys(createdAt).length > 0) {
    filter.createdAt = createdAt;
  }

  return filter;
};

const buildSort = (query: z.infer<typeof quizResultsQuerySchema>) => {
  const direction = query.sortOrder === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [query.sortBy]: direction };
  if (query.sortBy !== "createdAt") {
    sort.createdAt = -1;
  }
  return sort;
};

export const quizResultsRouter = Router();

quizResultsRouter.get(
  "/quiz-results/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = quizResultsQuerySchema.parse(req.query);
    const authUserId = String(req.authUser!.id);

    if (query.studentId && query.studentId !== authUserId) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your own results" });
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const filter = buildFilter(query, authUserId);
    const sort = buildSort(query);

    const [data, total] = await Promise.all([
      QuizResultModel.find(filter).select(buildResultProjection).sort(sort).skip(skip).limit(limit).lean(),
      QuizResultModel.countDocuments(filter),
    ]);

    return res.json({
      data,
      pagination: buildPaginationPayload(page, limit, total),
    });
  }),
);

quizResultsRouter.get(
  "/admin/quiz-results",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const query = quizResultsQuerySchema.parse(req.query);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const filter = buildFilter(query);
    const sort = buildSort(query);

    const [data, total] = await Promise.all([
      QuizResultModel.find(filter).select(buildResultProjection).sort(sort).skip(skip).limit(limit).lean(),
      QuizResultModel.countDocuments(filter),
    ]);

    return res.json({
      data,
      pagination: buildPaginationPayload(page, limit, total),
    });
  }),
);
