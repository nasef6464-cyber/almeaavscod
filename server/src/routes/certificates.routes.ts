import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
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
    const items = await CertificateModel.find({ userId: req.authUser!.id }).sort({ issuedAt: -1 }).lean();
    res.json({ certificates: items });
  }),
);

certificateRouter.get(
  "/:verificationCode",
  asyncHandler(async (req, res) => {
    const item = await CertificateModel.findOne({ verificationCode: String(req.params.verificationCode || "").trim() }).lean();
    if (!item) return res.status(StatusCodes.NOT_FOUND).json({ message: "Certificate not found" });
    res.json(item);
  }),
);

