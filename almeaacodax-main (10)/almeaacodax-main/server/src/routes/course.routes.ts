import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { z } from "zod";
import { CourseModel } from "../models/Course.js";
import { LessonModel } from "../models/Lesson.js";
import { QuizModel } from "../models/Quiz.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";
import { isStaffRole, withLearnerVisiblePaths } from "../services/visibility.js";

const badRequest = (message: string) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 400;
  return error;
};

const numberWithDefault = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return defaultValue;
    }
    return value;
  }, z.coerce.number().finite().default(defaultValue));

const nullableNumber = z.preprocess((value) => {
  if (value === "" || value === undefined) {
    return null;
  }
  return value;
}, z.coerce.number().finite().nullable().optional());

const assessmentSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  title: z.string(),
  phase: z.enum(["pre_course", "during_course", "final_course"]).default("during_course"),
  access: z.enum(["free_preview", "enrolled_paid"]).default("enrolled_paid"),
  showOnPlatform: z.boolean().default(true),
  order: z.coerce.number().finite().default(0),
});

const courseSchema = z.object({
  id: z.string().optional(),
  title: z.preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text || "Untitled Course";
  }, z.string().min(1)),
  thumbnail: z.string().optional(),
  instructor: z.preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text || "Platform Team";
  }, z.string().min(1)),
  price: numberWithDefault(0),
  currency: z.string().default("SAR"),
  duration: numberWithDefault(0),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]).default("Beginner"),
  rating: numberWithDefault(0),
  progress: numberWithDefault(0),
  category: z.string().default(""),
  subject: z.string().default(""),
  pathId: z.string().optional(),
  subjectId: z.string().optional(),
  sectionId: z.string().optional(),
  features: z.array(z.string()).default([]),
  description: z.string().optional(),
  instructorBio: z.string().optional(),
  modules: z.array(z.any()).default([]),
  assessments: z.array(assessmentSchema).optional(),
  isPublished: z.boolean().default(false),
  showOnPlatform: z.boolean().default(true),
  isPackage: z.boolean().default(false),
  packageType: z.enum(["courses", "videos", "tests", "membership"]).optional(),
  packageContentTypes: z.array(z.enum(["courses", "foundation", "banks", "tests", "library", "all"])).optional(),
  originalPrice: nullableNumber,
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
  approvedAt: nullableNumber,
  reviewerNotes: z.string().optional(),
  revenueSharePercentage: nullableNumber,
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

const buildCourseIdentityQuery = (id: string) => {
  const normalizedId = String(id || "").trim();
  return { $or: [{ _id: normalizedId }, { id: normalizedId }] };
};

const buildOwnedCourseQuery = (
  id: string,
  authUser: { id: string; role: string; schoolId?: string | null },
) => {
  const baseQuery = buildCourseIdentityQuery(id);

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

type CurriculumLesson = {
  id?: string;
  title?: string;
  type?: string;
  quizId?: string;
  pathId?: string;
  subjectId?: string;
};

type CurriculumModule = {
  id?: string;
  title?: string;
  lessons?: CurriculumLesson[];
};

const getRefIdCandidates = (value?: string) => {
  const raw = String(value || "").trim();
  if (!raw) return [];

  // Imported entries keep stable prefixes in the builder, e.g. course_quiz_<id>_<timestamp>.
  const prefixedMatch = raw.match(/^course_(quiz|lesson)_(.+)_\d+$/);
  if (prefixedMatch?.[2]) {
    return [prefixedMatch[2], raw];
  }

  return [raw];
};

const buildRefLookup = (idCandidates: string[]) => {
  const normalized = idCandidates.map((candidate) => String(candidate || "").trim()).filter(Boolean);
  const objectIdCandidates = normalized.filter((candidate) => mongoose.Types.ObjectId.isValid(candidate));
  const clauses: Array<Record<string, unknown>> = [{ id: { $in: normalized } }];
  if (objectIdCandidates.length > 0) {
    clauses.push({ _id: { $in: objectIdCandidates } });
  }
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

const isScopeMismatch = (
  itemPathId: string,
  itemSubjectId: string,
  coursePathId: string,
  courseSubjectId: string,
) => {
  if (!coursePathId || !courseSubjectId) return false;
  if (!itemPathId || !itemSubjectId) return false;
  return itemPathId !== coursePathId || itemSubjectId !== courseSubjectId;
};

const assertCurriculumImportScope = async (params: {
  coursePathId?: string;
  courseSubjectId?: string;
  modules?: CurriculumModule[];
}) => {
  const coursePathId = String(params.coursePathId || "").trim();
  const courseSubjectId = String(params.courseSubjectId || "").trim();
  const modules = Array.isArray(params.modules) ? params.modules : [];

  if (!coursePathId || !courseSubjectId || modules.length === 0) {
    return;
  }

  for (const moduleItem of modules) {
    const lessons = Array.isArray(moduleItem.lessons) ? moduleItem.lessons : [];

    for (const lesson of lessons) {
      const lessonPathId = String(lesson.pathId || "").trim();
      const lessonSubjectId = String(lesson.subjectId || "").trim();
      if (isScopeMismatch(lessonPathId, lessonSubjectId, coursePathId, courseSubjectId)) {
        throw badRequest(`Lesson scope mismatch in module \"${String(moduleItem.title || "")}\"`);
      }

      const quizId = String(lesson.quizId || "").trim();
      if (quizId) {
        const idCandidates = getRefIdCandidates(quizId);
        const quizDoc = await QuizModel.findOne(buildRefLookup(idCandidates))
          .select("pathId subjectId")
          .lean();

        if (!quizDoc) {
          throw badRequest(`Referenced quiz not found: ${quizId}`);
        }

        if (
          isScopeMismatch(
            String((quizDoc as { pathId?: string }).pathId || ""),
            String((quizDoc as { subjectId?: string }).subjectId || ""),
            coursePathId,
            courseSubjectId,
          )
        ) {
          throw badRequest(`Quiz scope mismatch: ${quizId}`);
        }
      }

      const lessonIdCandidates = getRefIdCandidates(String(lesson.id || ""));
      if (lessonIdCandidates.length > 0) {
        const lessonDoc = await LessonModel.findOne(buildRefLookup(lessonIdCandidates))
          .select("pathId subjectId")
          .lean();

        if (lessonDoc) {
          if (
            isScopeMismatch(
              String((lessonDoc as { pathId?: string }).pathId || ""),
              String((lessonDoc as { subjectId?: string }).subjectId || ""),
              coursePathId,
              courseSubjectId,
            )
          ) {
            throw badRequest(`Lesson import scope mismatch: ${String(lesson.id || "")}`);
          }
        }
      }
    }
  }
};

export const courseRouter = Router();

const PUBLIC_COURSE_LIST_CACHE_TTL_MS = 60 * 1000;
let publicCourseListCache:
  | {
      key: string;
      expiresAt: number;
      payload: {
        courses: unknown[];
        pagination: ReturnType<typeof buildPaginatedResponse>;
      };
    }
  | null = null;

const clearPublicCourseListCache = () => {
  publicCourseListCache = null;
};

courseRouter.use((req, _res, next) => {
  if (req.method !== "GET") {
    clearPublicCourseListCache();
  }
  next();
});

courseRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const isStaffViewer = isStaffRole(req.authUser?.role);
    const pagination = resolvePagination(req.query, { limit: 200 });
    const cacheKey = `${pagination.page}:${pagination.limit}`;

    if (!isStaffViewer && publicCourseListCache?.key === cacheKey && publicCourseListCache.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "private, max-age=60");
      res.setHeader("X-Course-List-Cache", "hit");
      return res.json(publicCourseListCache.payload);
    }

    const filter = await withLearnerVisiblePaths(buildCourseVisibilityFilter(req.authUser), req.authUser);
    const [items, total] = await Promise.all([
      CourseModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      CourseModel.countDocuments(filter),
    ]);
    const payload = {
      courses: items,
      pagination: buildPaginatedResponse([], pagination, total),
    };

    if (!isStaffViewer) {
      publicCourseListCache = {
        key: cacheKey,
        expiresAt: Date.now() + PUBLIC_COURSE_LIST_CACHE_TTL_MS,
        payload,
      };
      res.setHeader("Cache-Control", "private, max-age=60");
      res.setHeader("X-Course-List-Cache", "miss");
    }

    res.json(payload);
  }),
);

courseRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const visibilityFilter = await withLearnerVisiblePaths(buildCourseVisibilityFilter(req.authUser), req.authUser);
    const identityFilter = buildCourseIdentityQuery(req.params.id);
    const item = await CourseModel.findOne({
      $and: [identityFilter, visibilityFilter],
    });
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
    await assertCurriculumImportScope({
      coursePathId: payload.pathId,
      courseSubjectId: payload.subjectId,
      modules: payload.modules as CurriculumModule[],
    });
    const workflowDefaults = getWorkflowDefaults(req.authUser!);
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
    const existing = await CourseModel.findOne(buildOwnedCourseQuery(req.params.id, req.authUser!)).lean();
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
    }

    const nextPathId = String(payload.pathId || (existing as { pathId?: string }).pathId || "").trim();
    const nextSubjectId = String(payload.subjectId || (existing as { subjectId?: string }).subjectId || "").trim();
    const nextModules = Array.isArray(payload.modules)
      ? (payload.modules as CurriculumModule[])
      : ((existing as { modules?: CurriculumModule[] }).modules || []);

    await assertCurriculumImportScope({
      coursePathId: nextPathId,
      courseSubjectId: nextSubjectId,
      modules: nextModules,
    });

    const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);
    const updated = await CourseModel.findOneAndUpdate(
      { _id: (existing as { _id: string })._id },
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
    const deleted = await CourseModel.findOneAndDelete(buildOwnedCourseQuery(req.params.id, req.authUser!));
    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Course not found" });
    }
    return res.status(StatusCodes.NO_CONTENT).send();
  }),
);

