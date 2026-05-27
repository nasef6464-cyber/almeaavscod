import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { USE_PG } from "../utils/usePg.js";
import { db } from "../db/connection.js";
import { certificates, courses, users } from "../db/schema/index.js";
import { CertificateModel } from "../models/Certificate.js";
import { CourseModel } from "../models/Course.js";
import { UserModel } from "../models/User.js";

export const certificateRouter = Router();

const generateSchema = z.object({
  courseId: z.string().min(1),
});

certificateRouter.post(
  "/generate",
  requireAuth,
  requireRole(["student", "parent", "admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const { courseId } = generateSchema.parse(req.body);
    const userId = req.authUser!.id;

    if (USE_PG()) {
      const [courseRow] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
      if (!courseRow) return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });

      const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!userRow) return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });

      const moduleLessons = Array.isArray(courseRow.modules)
        ? courseRow.modules.flatMap((mod: any) => (Array.isArray(mod?.lessons) ? mod.lessons : []))
        : [];
      const totalLessons = moduleLessons.length;
      const completedSet = new Set((userRow.completedLessons || []).map(String));
      const completedInCourse = moduleLessons.filter((lesson: any) => completedSet.has(String(lesson?.id || lesson?._id))).length;
      const completionPercentage = totalLessons > 0 ? Math.round((completedInCourse / totalLessons) * 100) : 100;

      if (completionPercentage < 100) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Course completion is below 100%",
          completionPercentage,
        });
      }

      const [existing] = await db.select().from(certificates).where(
        and(eq(certificates.userId, userId), eq(certificates.courseId, courseId))
      ).limit(1);
      if (existing) return res.json(existing);

      const [created] = await db.insert(certificates).values({
        id: randomUUID(),
        userId,
        courseId,
        courseTitle: courseRow.title,
        pathId: courseRow.pathId ?? "",
        studentName: userRow.name ?? "Student",
        completionPercentage,
        certificateNumber: `CERT-${randomUUID().slice(0, 8).toUpperCase()}`,
        verificationCode: randomUUID(),
        issuedAt: new Date(),
      }).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const [user, course] = await Promise.all([
      UserModel.findById(userId).select("id name completedLessons"),
      CourseModel.findOne({ $or: [{ id: courseId }, { _id: courseId }] }).select("id title modules pathId category"),
    ]);
    if (!user) return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    if (!course) return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });

    const moduleLessons = Array.isArray(course.modules)
      ? course.modules.flatMap((mod: any) => (Array.isArray(mod?.lessons) ? mod.lessons : []))
      : [];
    const totalLessons = moduleLessons.length;
    const completedLessons = new Set((user.completedLessons || []).map(String));
    const completedInCourse = moduleLessons.filter((lesson: any) => completedLessons.has(String(lesson?.id || lesson?._id))).length;
    const completionPercentage = totalLessons > 0 ? Math.round((completedInCourse / totalLessons) * 100) : 100;

    if (completionPercentage < 100) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Course completion is below 100%",
        completionPercentage,
      });
    }

    const existing = await CertificateModel.findOne({ userId, courseId: String(course.id || course._id) });
    if (existing) return res.json(existing);

    const created = await CertificateModel.create({
      userId,
      courseId: String(course.id || course._id),
      pathId: String(course.pathId || course.category || ""),
      issuedAt: new Date(),
      verificationCode: randomUUID(),
      studentName: String(user.name || "Student"),
      courseName: String(course.title || "Course"),
      completionPercentage,
    });
    return res.status(StatusCodes.CREATED).json(created);
  }),
);

certificateRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const items = await db.select().from(certificates)
        .where(eq(certificates.userId, req.authUser!.id))
        .orderBy(desc(certificates.issuedAt));
      return res.json({ certificates: items });
    }

    const items = await CertificateModel.find({ userId: req.authUser!.id }).sort({ issuedAt: -1 }).lean();
    res.json({ certificates: items });
  }),
);

certificateRouter.get(
  "/:verificationCode",
  asyncHandler(async (req, res) => {
    const verificationCode = String(req.params.verificationCode || "").trim();

    if (USE_PG()) {
      const [item] = await db.select().from(certificates)
        .where(eq(certificates.verificationCode, verificationCode))
        .limit(1);
      if (!item) return res.status(StatusCodes.NOT_FOUND).json({ message: "Certificate not found" });
      return res.json(item);
    }

    const item = await CertificateModel.findOne({ verificationCode }).lean();
    if (!item) return res.status(StatusCodes.NOT_FOUND).json({ message: "Certificate not found" });
    res.json(item);
  }),
);

