import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { eq, and, or, ne, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import { CourseModel } from "../models/Course.js";
import { db } from "../db/connection.js";
import { courses } from "../db/schema/index.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isStaffRole } from "../services/visibility.js";
import { USE_PG } from "../utils/usePg.js";



const courseSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  thumbnail: z.string().optional(),
  instructor: z.string().min(1),
  price: z.number().default(0),
  currency: z.string().default("SAR"),
  duration: z.number().default(0),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]).default("Beginner"),
  rating: z.number().default(0),
  progress: z.number().default(0),
  category: z.string().default(""),
  subject: z.string().default(""),
  pathId: z.string().optional(),
  subjectId: z.string().optional(),
  sectionId: z.string().optional(),
  features: z.array(z.string()).default([]),
  description: z.string().optional(),
  instructorBio: z.string().optional(),
  modules: z.array(z.any()).default([]),
  isPublished: z.boolean().default(false),
  showOnPlatform: z.boolean().default(true),
  isPackage: z.boolean().default(false),
  packageType: z.enum(["courses", "videos", "tests"]).optional(),
  packageContentTypes: z.array(z.enum(["courses", "foundation", "banks", "tests", "library", "all"])).optional(),
  originalPrice: z.number().nullable().optional(),
  includedCourses: z.array(z.string()).optional(),
  prerequisiteCourseIds: z.array(z.string()).optional(),
  dripContentEnabled: z.boolean().optional(),
  certificateEnabled: z.boolean().optional(),
  skills: z.array(z.string()).optional(),
  ownerType: z.enum(["platform", "teacher", "school"]).optional(),
  ownerId: z.string().optional(),
  createdBy: z.string().optional(),
  assignedTeacherId: z.string().optional(),
  approvalStatus: z.enum(["draft", "pending_review", "approved", "rejected"]).optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.number().nullable().optional(),
  reviewerNotes: z.string().optional(),
  revenueSharePercentage: z.number().nullable().optional(),
});

const getWorkflowDefaults = (authUser?: { id: string; role: string; schoolId?: string | null }) => {
  if (!authUser) {
    return {};
  }

  if (authUser.role === "admin") {
    return {
      ownerType: "platform",
      ownerId: authUser.id,
      createdBy: authUser.id,
      approvalStatus: "approved",
      approvedBy: authUser.id,
      approvedAt: Date.now(),
    };
  }

  if (authUser.role === "teacher") {
    return {
      ownerType: "teacher",
      ownerId: authUser.id,
      createdBy: authUser.id,
      assignedTeacherId: authUser.id,
      approvalStatus: "pending_review",
      approvedBy: "",
      approvedAt: null,
    };
  }

  return {
    ownerType: "school",
    ownerId: authUser.schoolId || authUser.id,
    createdBy: authUser.id,
    approvalStatus: "pending_review",
    approvedBy: "",
    approvedAt: null,
  };
};

const sanitizeWorkflowUpdate = (
  payload: Record<string, unknown>,
  authUser: { id: string; role: string; schoolId?: string | null },
) => {
  const nextPayload = { ...payload };

  if (authUser.role !== "admin") {
    delete nextPayload.ownerType;
    delete nextPayload.ownerId;
    delete nextPayload.createdBy;
    delete nextPayload.approvedBy;
    delete nextPayload.approvedAt;
    delete nextPayload.reviewerNotes;
    delete nextPayload.revenueSharePercentage;
    if (typeof nextPayload.approvalStatus === "string" && nextPayload.approvalStatus === "approved") {
      nextPayload.approvalStatus = "pending_review";
    }
    if (nextPayload.isPublished === true) {
      nextPayload.isPublished = false;
    }
  } else {
    if (typeof nextPayload.approvalStatus === "string") {
      if (nextPayload.approvalStatus === "approved") {
        nextPayload.approvedBy = authUser.id;
        nextPayload.approvedAt = Date.now();
      } else if (nextPayload.approvalStatus === "rejected" || nextPayload.approvalStatus === "pending_review") {
        nextPayload.approvedBy = "";
        nextPayload.approvedAt = null;
        nextPayload.isPublished = false;
      }
    }
  }

  return nextPayload;
};

const buildCourseVisibilityFilter = (authUser?: { role?: string; id?: string }) => {
  if (isStaffRole(authUser?.role)) {
    return {};
  }

  return {
    isPublished: true,
    showOnPlatform: { $ne: false },
    $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
  };
};

const buildOwnedCourseQuery = (
  id: string,
  authUser: { id: string; role: string; schoolId?: string | null },
) => {
  const baseQuery = { _id: id };

  if (authUser.role === "admin") {
    return baseQuery;
  }

  const ownershipConditions: Array<Record<string, string>> = [
    { ownerId: authUser.id },
    { createdBy: authUser.id },
    { assignedTeacherId: authUser.id },
  ];

  if (authUser.schoolId) {
    ownershipConditions.push({ ownerId: authUser.schoolId }, { createdBy: authUser.schoolId });
  }

  return { $and: [baseQuery, { $or: ownershipConditions }] };
};

export const courseRouter = Router();

courseRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const conditions = [];
      if (!isStaffRole(req.authUser?.role)) {
        conditions.push(eq(courses.isPublished, true));
        conditions.push(ne(courses.showOnPlatform, false));
        conditions.push(
          or(eq(courses.approvalStatus, "approved"), isNull(courses.approvalStatus))
        );
      }
      const items = await db.select().from(courses)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(courses.createdAt));
      return res.json(items);
    }

    const filter = buildCourseVisibilityFilter(req.authUser);
    const items = await CourseModel.find(filter).sort({ createdAt: -1 });
    res.json(items);
  }),
);

courseRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const result = await db.select().from(courses).where(eq(courses.id, req.params.id)).limit(1);
      const item = result[0];
      if (!item) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
      }
      return res.json(item);
    }

    const item = await CourseModel.findOne({ _id: req.params.id });
    if (!item) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
    }
    return res.json(item);
  }),
);

courseRouter.post(
  "/",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = courseSchema.parse(req.body);
    const workflowDefaults = getWorkflowDefaults(req.authUser!);

    if (USE_PG()) {
      const id = payload.id || `course_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(courses).values({
        id,
        ...payload,
        ...workflowDefaults,
        approvalStatus: req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
        isPublished: req.authUser?.role === "admin" ? payload.isPublished : false,
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await CourseModel.create({
      ...payload,
      ...workflowDefaults,
      approvalStatus:
        req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
      isPublished: req.authUser?.role === "admin" ? payload.isPublished : false,
      ...(payload.id ? { _id: payload.id } : {}),
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

courseRouter.patch(
  "/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = courseSchema.partial().parse(req.body);
    const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);

    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(courses).where(eq(courses.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
        }
      }
      const [updated] = await db.update(courses)
        .set(sanitizedPayload as any)
        .where(eq(courses.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
      }
      return res.json(updated);
    }

    const updated = await CourseModel.findOneAndUpdate(
      buildOwnedCourseQuery(req.params.id, req.authUser!),
      sanitizedPayload,
      { new: true },
    );
    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
    }
    return res.json(updated);
  }),
);

courseRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(courses).where(eq(courses.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
        }
      }
      await db.delete(courses).where(eq(courses.id, req.params.id));
      return res.status(StatusCodes.NO_CONTENT).send();
    }

    const deleted = await CourseModel.findOneAndDelete(buildOwnedCourseQuery(req.params.id, req.authUser!));
    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
    }
    return res.status(StatusCodes.NO_CONTENT).send();
  }),
);
