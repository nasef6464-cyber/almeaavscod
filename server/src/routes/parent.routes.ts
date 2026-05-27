import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { eq, and, desc, count, avg, or, inArray } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { db } from "../db/connection.js";
import { users, quizResults, skillProgress, courses, lessons } from "../db/schema/index.js";
import { UserModel } from "../models/User.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { SkillProgressModel } from "../models/SkillProgress.js";
import { CourseModel } from "../models/Course.js";
import { USE_PG } from "../utils/usePg.js";



export const parentRouter = Router();

parentRouter.get(
  "/children",
  requireAuth,
  requireRole(["parent"]),
  asyncHandler(async (req, res) => {
    const parentUserId = req.authUser!.id;

    if (USE_PG()) {
      const parent = await db.select().from(users).where(eq(users.id, parentUserId)).limit(1);
      const linkedStudentIds = parent[0]?.linkedStudentIds || [];

      if (linkedStudentIds.length === 0) {
        return res.json({ children: [] });
      }

      const children = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        role: users.role,
        points: users.points,
        subscriptionPlan: users.subscriptionPlan,
        isActive: users.isActive,
        createdAt: users.createdAt,
      }      ).from(users).where(
        and(eq(users.role, "student"), inArray(users.id, linkedStudentIds))
      );

      return res.json({ children });
    }

    const parentUser = await UserModel.findById(parentUserId);
    const linkedStudentIds = parentUser?.linkedStudentIds || [];

    const children = await UserModel.find({
      _id: { $in: linkedStudentIds },
      role: "student",
    }).select("id name email avatar role points subscriptionPlan isActive createdAt");

    return res.json({ children });
  }),
);

parentRouter.get(
  "/children/:childId/overview",
  requireAuth,
  requireRole(["parent"]),
  asyncHandler(async (req, res) => {
    const parentUserId = req.authUser!.id;
    const childId = req.params.childId;

    if (USE_PG()) {
      const parent = await db.select().from(users).where(eq(users.id, parentUserId)).limit(1);
      const linkedStudentIds = parent[0]?.linkedStudentIds || [];

      if (!linkedStudentIds.includes(childId)) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
      }

      const [quizCountResult, avgScoreResult, childResult] = await Promise.all([
        db.select({ count: count() }).from(quizResults).where(eq(quizResults.userId, childId)),
        db.select({ avg: avg(quizResults.score) }).from(quizResults).where(eq(quizResults.userId, childId)),
        db.select().from(users).where(eq(users.id, childId)).limit(1),
      ]);

      const totalQuizzes = quizCountResult[0]?.count || 0;
      const averageScore = avgScoreResult[0]?.avg ? Math.round(Number(avgScoreResult[0].avg)) : 0;

      const recentQuizzes = await db.select().from(quizResults)
        .where(eq(quizResults.userId, childId))
        .orderBy(desc(quizResults.createdAt))
        .limit(5);

      return res.json({
        child: childResult[0],
        stats: {
          totalQuizzes,
          averageScore,
          totalSkills: 0,
          masteredSkills: 0,
        },
        recentQuizzes,
      });
    }

    const parentUser = await UserModel.findById(parentUserId);
    const linkedStudentIds = parentUser?.linkedStudentIds || [];

    if (!linkedStudentIds.includes(childId)) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
    }

    const [totalQuizzes, avgScoreResult, recentQuizzes, child] = await Promise.all([
      QuizResultModel.countDocuments({ userId: childId }),
      QuizResultModel.aggregate([
        { $match: { userId: childId } },
        { $group: { _id: null, avgScore: { $avg: "$score" } } },
      ]),
      QuizResultModel.find({ userId: childId }).sort({ createdAt: -1 }).limit(5),
      UserModel.findById(childId).select("id name email avatar role points subscriptionPlan isActive createdAt"),
    ]);

    const averageScore = avgScoreResult[0] ? Math.round(avgScoreResult[0].avgScore) : 0;

    return res.json({
      child,
      stats: { totalQuizzes, averageScore, totalSkills: 0, masteredSkills: 0 },
      recentQuizzes,
    });
  }),
);

parentRouter.get(
  "/children/:childId/quiz-results",
  requireAuth,
  requireRole(["parent"]),
  asyncHandler(async (req, res) => {
    const parentUserId = req.authUser!.id;
    const childId = req.params.childId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    if (USE_PG()) {
      const parent = await db.select().from(users).where(eq(users.id, parentUserId)).limit(1);
      const linkedStudentIds = parent[0]?.linkedStudentIds || [];

      if (!linkedStudentIds.includes(childId)) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
      }

      const [data, totalResult] = await Promise.all([
        db.select().from(quizResults).where(eq(quizResults.userId, childId))
          .orderBy(desc(quizResults.createdAt)).limit(limit).offset(skip),
        db.select({ count: count() }).from(quizResults).where(eq(quizResults.userId, childId)),
      ]);

      return res.json({
        data,
        pagination: {
          total: totalResult[0]?.count || 0,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil((totalResult[0]?.count || 0) / limit)),
        },
      });
    }

    const parentUser = await UserModel.findById(parentUserId);
    const linkedStudentIds = parentUser?.linkedStudentIds || [];

    if (!linkedStudentIds.includes(childId)) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
    }

    const [data, total] = await Promise.all([
      QuizResultModel.find({ userId: childId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      QuizResultModel.countDocuments({ userId: childId }),
    ]);

    return res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }),
);

parentRouter.get(
  "/children/:childId/skills",
  requireAuth,
  requireRole(["parent"]),
  asyncHandler(async (req, res) => {
    const parentUserId = req.authUser!.id;
    const childId = req.params.childId;

    if (USE_PG()) {
      const parent = await db.select().from(users).where(eq(users.id, parentUserId)).limit(1);
      const linkedStudentIds = parent[0]?.linkedStudentIds || [];

      if (!linkedStudentIds.includes(childId)) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
      }

      const skills = await db.select().from(skillProgress)
        .where(eq(skillProgress.userId, childId))
        .orderBy(desc(skillProgress.lastAttemptAt));

      const masteredSkills = skills.filter((s) => s.status === "mastered" || (s.mastery || 0) >= 80).length;
      const weakSkills = skills.filter((s) => s.status === "weak" || (s.mastery || 0) < 40).length;

      return res.json({
        skills,
        summary: {
          total: skills.length,
          mastered: masteredSkills,
          weak: weakSkills,
          averageMastery: skills.length > 0
            ? Math.round(skills.reduce((sum, s) => sum + (s.mastery || 0), 0) / skills.length)
            : 0,
        },
      });
    }

    const parentUser = await UserModel.findById(parentUserId);
    const linkedStudentIds = parentUser?.linkedStudentIds || [];

    if (!linkedStudentIds.includes(childId)) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
    }

    const skills = await SkillProgressModel.find({ userId: childId }).sort({ lastAttemptAt: -1 });
    const masteredSkills = skills.filter((s) => s.status === "mastered" || (s.mastery || 0) >= 80).length;
    const weakSkills = skills.filter((s) => s.status === "weak" || (s.mastery || 0) < 40).length;

    return res.json({
      skills,
      summary: {
        total: skills.length,
        mastered: masteredSkills,
        weak: weakSkills,
        averageMastery: skills.length > 0
          ? Math.round(skills.reduce((sum, s) => sum + (s.mastery || 0), 0) / skills.length)
          : 0,
      },
    });
  }),
);

parentRouter.get(
  "/children/:childId/courses",
  requireAuth,
  requireRole(["parent"]),
  asyncHandler(async (req, res) => {
    const parentUserId = req.authUser!.id;
    const childId = req.params.childId;

    if (USE_PG()) {
      const parent = await db.select().from(users).where(eq(users.id, parentUserId)).limit(1);
      const linkedStudentIds = parent[0]?.linkedStudentIds || [];

      if (!linkedStudentIds.includes(childId)) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
      }

      const child = await db.select().from(users).where(eq(users.id, childId)).limit(1);
      const purchasedCourses = child[0]?.purchasedCourses || [];

      if (purchasedCourses.length === 0) {
        return res.json({ courses: [] });
      }

      const coursesData = await db.select().from(courses).where(inArray(courses.id, purchasedCourses));

      return res.json({ courses: coursesData });
    }

    const parentUser = await UserModel.findById(parentUserId);
    const linkedStudentIds = parentUser?.linkedStudentIds || [];

    if (!linkedStudentIds.includes(childId)) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You can only access your children's data" });
    }

    const child = await UserModel.findById(childId);
    const purchasedCourses = child?.subscription?.purchasedCourses || [];

    const coursesData = await CourseModel.find({ _id: { $in: purchasedCourses } });

    return res.json({ courses: coursesData });
  }),
);
