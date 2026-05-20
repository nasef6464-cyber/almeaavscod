import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { z } from "zod";
import { QuizModel } from "../models/Quiz.js";
import { QuestionModel } from "../models/Question.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { UserModel } from "../models/User.js";
import { GroupModel } from "../models/Group.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { CourseModel } from "../models/Course.js";
import { SkillProgressModel } from "../models/SkillProgress.js";
import { QuestionAttemptModel } from "../models/QuestionAttempt.js";
import { SkillModel } from "../models/Skill.js";
import { SubjectModel } from "../models/Subject.js";
import { SectionModel } from "../models/Section.js";
import { TopicModel } from "../models/Topic.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";
import { getActivePathIds, isStaffRole, withLearnerVisiblePaths } from "../services/visibility.js";
import { recordAdminAuditLog } from "../services/adminAuditLog.js";

const questionBaseSchema = z.object({
  id: z.string().optional(),
  text: z.string().default(""),
  options: z.array(z.string()).default([]),
  correctOptionIndex: z.number().default(0),
  explanation: z.string().optional(),
  videoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  skillIds: z.array(z.string()).min(1),
  pathId: z.string().min(1),
  subject: z.string().min(1),
  sectionId: z.string().optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  type: z.enum(["mcq", "true_false", "essay"]).default("mcq"),
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

const questionSchema = questionBaseSchema.refine(
  (value) => value.text.trim().length > 0 || String(value.imageUrl || "").trim().length > 0,
  {
    message: "Question must include text or an image URL",
    path: ["text"],
  },
);

const questionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(80),
  ids: z.string().trim().optional(),
  pathId: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  sectionId: z.string().trim().optional(),
  skillId: z.string().trim().optional(),
  approvalStatus: z.enum(["draft", "pending_review", "approved", "rejected"]).optional(),
  search: z.string().trim().max(120).optional(),
  summary: z.coerce.boolean().default(false),
  noTotal: z.coerce.boolean().default(false),
});

const dashboardAnalyticsQuerySchema = z.object({
  studentLimit: z.coerce.number().int().min(1).max(1000).default(500),
  resultLimit: z.coerce.number().int().min(100).max(5000).default(2000),
  attemptLimit: z.coerce.number().int().min(100).max(5000).default(3000),
});

const quizResultsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  noTotal: z.coerce.boolean().default(false),
  search: z.string().trim().max(120).optional(),
  quizId: z.string().trim().max(120).optional(),
  studentId: z.string().trim().max(120).optional(),
  status: z.enum(["passed", "failed"]).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "score", "quizTitle", "date"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const QUESTION_SUMMARY_TEXT_LIMIT = 280;
const PUBLIC_QUIZ_LIST_CACHE_TTL_MS = 30 * 1000;
const QUESTION_SUMMARY_CACHE_TTL_MS = 30 * 1000;
const QUESTION_SUMMARY_CACHE_MAX_ENTRIES = 100;
const QUIZ_RESULTS_CACHE_TTL_MS = 5 * 1000;
const QUIZ_RESULTS_CACHE_MAX_ENTRIES = 300;

let publicQuizListCache:
  | {
      expiresAt: number;
      payload: unknown;
    }
  | null = null;
let publicQuestionSummaryCache = new Map<
  string,
  {
    expiresAt: number;
    payload: unknown[];
    hasMore: boolean;
  }
>();
let quizResultsCache = new Map<
  string,
  {
    expiresAt: number;
    payload: unknown;
  }
>();

const clearPublicQuizListCache = () => {
  publicQuizListCache = null;
};

const clearPublicQuestionSummaryCache = () => {
  publicQuestionSummaryCache.clear();
};

const clearQuizResultsCache = () => {
  quizResultsCache.clear();
};

const buildQuizResultsCacheKey = (
  userId: string,
  originalUrl: string,
  includeReview: boolean,
) => `${userId}:${includeReview ? "review" : "list"}:${originalUrl}`;

const trimQuizResultsCacheIfNeeded = () => {
  if (quizResultsCache.size <= QUIZ_RESULTS_CACHE_MAX_ENTRIES) return;
  const firstKey = quizResultsCache.keys().next().value;
  if (firstKey) {
    quizResultsCache.delete(firstKey);
  }
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDateFilter = (value?: string) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildQuestionSummaryCacheKey = (query: z.infer<typeof questionListQuerySchema>) =>
  JSON.stringify({
    page: query.page,
    limit: query.limit,
    pathId: query.pathId || "",
    subject: query.subject || "",
    sectionId: query.sectionId || "",
    skillId: query.skillId || "",
  });

const toQuestionSummaryText = (value: unknown) => {
  const raw = typeof value === "string" ? value : "";
  const plain = raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > QUESTION_SUMMARY_TEXT_LIMIT
    ? `${plain.slice(0, QUESTION_SUMMARY_TEXT_LIMIT).trim()}...`
    : plain;
};

const sanitizeQuestionForLearner = (question: Record<string, any>) => {
  const { correctOptionIndex, explanation, __v, ...safeQuestion } = question;
  return safeQuestion;
};

const isQuestionContentUsable = (question: any) => {
  const hasText = String(question?.text || "").trim().length > 0;
  const hasImage = String(question?.imageUrl || "").trim().length > 0;
  if (!hasText && !hasImage) return false;

  const type = String(question?.type || "mcq");
  if (type === "mcq" || type === "true_false") {
    return Array.isArray(question?.options) && question.options.length >= 2;
  }
  return true;
};

const validateQuizQuestionIntegrity = async (quizLike: any) => {
  const normalizedIds = uniqueStrings(getQuizQuestionIds(quizLike).map((value) => String(value || "").trim()).filter(Boolean));
  if (normalizedIds.length === 0) {
    return {
      ok: false,
      totalReferenced: 0,
      resolved: 0,
      missingIds: [] as string[],
      invalidContentIds: [] as string[],
      message: "Cannot publish a quiz without valid questions",
    };
  }

  const questions = await QuestionModel.find(buildDocumentsByIdsQuery(normalizedIds))
    .select("id text imageUrl options type")
    .lean();
  const byCanonicalId = new Map<string, any>();

  questions.forEach((question: any) => {
    const canonicalId = String(question.id || question._id);
    byCanonicalId.set(canonicalId, question);
    const withoutCopySuffix = canonicalId.replace(/_copy(?:_\d+)?$/i, "");
    if (withoutCopySuffix && withoutCopySuffix !== canonicalId) {
      byCanonicalId.set(withoutCopySuffix, question);
    }
  });

  const missingIds: string[] = [];
  const invalidContentIds: string[] = [];
  normalizedIds.forEach((id) => {
    const resolved = byCanonicalId.get(id) || byCanonicalId.get(id.replace(/_copy(?:_\d+)?$/i, ""));
    if (!resolved) {
      missingIds.push(id);
      return;
    }
    if (!isQuestionContentUsable(resolved)) {
      invalidContentIds.push(id);
    }
  });

  const ok = missingIds.length === 0 && invalidContentIds.length === 0;
  return {
    ok,
    totalReferenced: normalizedIds.length,
    resolved: normalizedIds.length - missingIds.length,
    missingIds,
    invalidContentIds,
    message: ok
      ? "ok"
      : "Cannot publish quiz: some referenced questions are missing or have incomplete content",
  };
};

const quizSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  pathId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  type: z.enum(["quiz", "bank"]).default("quiz"),
  placement: z.enum(["training", "mock", "both"]).optional(),
  showInTraining: z.boolean().optional(),
  showInMock: z.boolean().optional(),
  learningPlacements: z.array(z.object({
    pathId: z.string().min(1),
    subjectId: z.string().optional().default(""),
    slot: z.enum(["training", "tests", "foundation", "course"]),
    accessType: z.enum(["inherit", "free", "paid"]).optional().default("inherit"),
    isVisible: z.boolean().optional().default(true),
    order: z.number().optional().default(0),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
  })).optional(),
  mode: z.enum(["regular", "saher", "central"]).default("regular"),
  settings: z.record(z.any()),
  access: z.record(z.any()),
  questionIds: z.array(z.string()).default([]),
  mockExam: z.object({
    enabled: z.boolean().default(false),
    pathId: z.string().default(""),
    sections: z.array(z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      subjectId: z.string().optional().default(""),
      questionIds: z.array(z.string()).default([]),
      timeLimit: z.number().nullable().optional(),
      order: z.number().optional(),
    })).default([]),
  }).optional(),
  skillIds: z.array(z.string()).optional(),
  targetGroupIds: z.array(z.string()).default([]),
  targetUserIds: z.array(z.string()).default([]),
  dueDate: z.string().nullable().optional(),
  isPublished: z.boolean().default(false),
  showOnPlatform: z.boolean().default(true),
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

const normalizeQuizPlacementPayload = <T extends Record<string, any>>(payload: T, fallbackType = "quiz") => {
  const hasPlacementFields =
    payload.type !== undefined ||
    payload.placement !== undefined ||
    payload.showInTraining !== undefined ||
    payload.showInMock !== undefined;

  if (!hasPlacementFields) return payload;

  const inferredType = payload.type || fallbackType;
  const showInTraining =
    typeof payload.showInTraining === "boolean"
      ? payload.showInTraining
      : payload.placement
        ? payload.placement === "training" || payload.placement === "both"
        : inferredType === "bank";
  const showInMock =
    typeof payload.showInMock === "boolean"
      ? payload.showInMock
      : payload.placement
        ? payload.placement === "mock" || payload.placement === "both"
        : inferredType !== "bank";
  const placement = showInTraining && showInMock ? "both" : showInTraining ? "training" : "mock";

  return {
    ...payload,
    type: showInTraining && !showInMock ? "bank" : "quiz",
    placement,
    showInTraining,
    showInMock,
  };
};

const questionAttemptSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIndex: z.number().default(-1),
  timeSpentSeconds: z.number().default(0),
  date: z.string().optional(),
});

const quizSubmitSchema = z.object({
  answers: z.record(z.coerce.number()).default({}),
  timeSpentSeconds: z.number().min(0).default(0),
  source: z.string().optional(),
});

const DIRECT_RESULT_DISABLED_MESSAGE =
  "Direct quiz result creation is disabled. Submit quiz answers through /api/quizzes/:id/submit.";

const getQuizMaxAttempts = (quiz: any) => {
  const value = Number(quiz?.settings?.maxAttempts ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const getQuizPassingScore = (quiz: any) => {
  const value = Number(quiz?.settings?.passingScore ?? 60);
  if (!Number.isFinite(value)) return 60;
  return Math.min(100, Math.max(0, value));
};

const assertQuizWindowIsOpen = (
  quiz: any,
  payload: z.infer<typeof quizSubmitSchema>,
): { ok: true } | { ok: false; status: number; message: string } => {
  const dueDateRaw = String(quiz?.dueDate || "").trim();
  if (dueDateRaw) {
    const dueDateMs = Date.parse(dueDateRaw);
    if (Number.isFinite(dueDateMs) && Date.now() > dueDateMs) {
      return {
        ok: false,
        status: StatusCodes.FORBIDDEN,
        message: "Quiz submission deadline has passed",
      };
    }
  }

  const timeLimitMinutes = Number(quiz?.settings?.timeLimit ?? 0);
  if (Number.isFinite(timeLimitMinutes) && timeLimitMinutes > 0) {
    const allowedSeconds = Math.ceil(timeLimitMinutes * 60) + 60;
    if (payload.timeSpentSeconds > allowedSeconds) {
      return {
        ok: false,
        status: StatusCodes.REQUEST_TIMEOUT,
        message: "Quiz time limit exceeded",
      };
    }
  }

  return { ok: true };
};

const buildSubmissionKey = (userId: string, quizId: string, attemptNumber: number) =>
  `quiz-submit:${userId}:${quizId}:attempt:${attemptNumber}`;

const buildDocumentQuery = (value: string) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return { $or: [{ id: value }, { _id: value }] };
  }

  return { id: value };
};

const buildOwnedDocumentQuery = (
  value: string,
  authUser: { id: string; role: string; schoolId?: string | null },
) => {
  const baseQuery = buildDocumentQuery(value);

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

const buildDocumentsByIdsQuery = (values: string[]) => {
  const ids = uniqueStrings(
    values
      .flatMap((value) => {
        const id = String(value || "").trim();
        if (!id) return [];
        const withoutCopySuffix = id.replace(/_copy(?:_\d+)?$/i, "");
        return withoutCopySuffix && withoutCopySuffix !== id ? [id, withoutCopySuffix] : [id];
      })
      .filter(Boolean),
  );
  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  return {
    $or: [
      { id: { $in: ids } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
    ],
  };
};

const resolveQuizSkillIds = async (questionIds: string[]) => {
  if (questionIds.length === 0) {
    return [];
  }

  const questions = await QuestionModel.find({ id: { $in: questionIds } }).select("skillIds");
  return [...new Set(questions.flatMap((question) => question.skillIds || []).filter(Boolean))];
};

const getQuizQuestionIds = (quiz: any) => {
  const mockSections = Array.isArray(quiz?.mockExam?.sections) ? quiz.mockExam.sections : [];
  const mockQuestionIds = quiz?.mockExam?.enabled === true
    ? mockSections.flatMap((section: any) => Array.isArray(section?.questionIds) ? section.questionIds.map(String) : [])
    : [];
  const regularQuestionIds = Array.isArray(quiz?.questionIds) ? quiz.questionIds.map(String) : [];
  return uniqueStrings((mockQuestionIds.length > 0 ? mockQuestionIds : regularQuestionIds).filter(Boolean));
};

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
  options?: { respectPublished?: boolean },
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
    if (options?.respectPublished && nextPayload.isPublished === true) {
      nextPayload.isPublished = false;
    }
  } else if (typeof nextPayload.approvalStatus === "string") {
    if (nextPayload.approvalStatus === "approved") {
      nextPayload.approvedBy = authUser.id;
      nextPayload.approvedAt = Date.now();
    } else if (nextPayload.approvalStatus === "rejected" || nextPayload.approvalStatus === "pending_review") {
      nextPayload.approvedBy = "";
      nextPayload.approvedAt = null;
      if (options?.respectPublished) {
        nextPayload.isPublished = false;
      }
    }
  }

  return nextPayload;
};

const assertTeacherManagedScope = async (
  authUser: { id: string; role: string },
  payload: { pathId?: unknown; subjectId?: unknown; subject?: unknown },
) => {
  if (authUser.role !== "teacher") {
    return;
  }

  const teacher = await UserModel.findById(authUser.id).select("managedPathIds managedSubjectIds");
  const managedPathIds = new Set((teacher?.managedPathIds || []).map(String));
  const managedSubjectIds = new Set((teacher?.managedSubjectIds || []).map(String));

  if (managedPathIds.size === 0 && managedSubjectIds.size === 0) {
    return;
  }

  const pathId = String(payload.pathId || "");
  const subjectId = String(payload.subjectId || payload.subject || "");
  const matchesPath = !!pathId && managedPathIds.has(pathId);
  const matchesSubject = !!subjectId && managedSubjectIds.has(subjectId);

  if (!matchesPath && !matchesSubject) {
    const error = new Error("Content is outside the teacher managed scope") as Error & { statusCode?: number };
    error.statusCode = StatusCodes.FORBIDDEN;
    throw error;
  }
};

const uniqueStrings = (values: Array<string | undefined | null>) =>
  [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];

const idOf = (item: any) => String(item?.id || item?._id || "");

const MIN_ANALYTICS_SKILL_EVIDENCE_COUNT = 3;

const buildRecommendedAction = (mastery: number, attemptCount: number) => {
  if (mastery < 45) {
    return "خطة علاج عاجلة: شرح + تدريب + اختبار موجه";
  }

  if (mastery < 65) {
    return attemptCount >= 3 ? "زيادة التدريب ثم اختبار ساهر علاجي" : "إضافة تدريب قصير ومتابعة الأداء";
  }

  return "تثبيت المهارة بتدريب خفيف وإعادة قياس لاحقًا";
};

const buildSkillStatus = (mastery: number) => {
  if (mastery >= 90) return "mastered";
  if (mastery >= 75) return "good";
  if (mastery >= 50) return "average";
  return "weak";
};

const buildResultSkillStatus = (mastery: number) => {
  if (mastery >= 80) return "strong";
  if (mastery >= 50) return "average";
  return "weak";
};

const buildSkillRecommendation = (mastery: number) => {
  if (mastery < 50) return "راجع شرحًا قصيرًا ثم حل تدريبًا موجّهًا على نفس المهارة";
  if (mastery < 80) return "أداؤك قريب من الإتقان. زد التدريب قليلًا ثم أعد القياس";
  return "أداء ممتاز. حافظ على المهارة بتدريب خفيف من وقت لآخر";
};

const matchesContentScope = (
  item: { contentTypes?: string[]; pathIds?: string[]; subjectIds?: string[] },
  contentType: string,
  pathId?: string,
  subjectId?: string,
) => {
  const contentTypes = Array.isArray(item.contentTypes) && item.contentTypes.length ? item.contentTypes : ["all"];
  const pathIds = Array.isArray(item.pathIds) ? item.pathIds.map(String).filter(Boolean) : [];
  const subjectIds = Array.isArray(item.subjectIds) ? item.subjectIds.map(String).filter(Boolean) : [];
  const matchesType = contentTypes.includes("all") || contentTypes.includes(contentType);
  const matchesPath = pathIds.length === 0 || (!!pathId && pathIds.includes(pathId));
  const matchesSubject = subjectIds.length === 0 || (!!subjectId && subjectIds.includes(subjectId));
  return matchesType && matchesPath && matchesSubject;
};

const hasPurchasedPackageAccess = async (
  purchasedPackageIds: string[],
  contentType: string,
  pathId?: string,
  subjectId?: string,
) => {
  if (purchasedPackageIds.length === 0) {
    return false;
  }

  const packages = await CourseModel.find({
    _id: { $in: purchasedPackageIds },
    isPackage: true,
    isPublished: true,
    showOnPlatform: { $ne: false },
  }).select("_id pathId subjectId packageContentTypes includedCourses");

  return packages.some((pkg: any) => {
    const contentTypes = Array.isArray(pkg.packageContentTypes) && pkg.packageContentTypes.length
      ? pkg.packageContentTypes
      : ["courses"];
    return matchesContentScope(
      {
        contentTypes,
        pathIds: pkg.pathId ? [String(pkg.pathId)] : [],
        subjectIds: pkg.subjectId ? [String(pkg.subjectId)] : [],
      },
      contentType,
      pathId,
      subjectId,
    );
  });
};

const hasSchoolPackageAccess = async (
  user: any,
  contentType: string,
  pathId?: string,
  subjectId?: string,
) => {
  const schoolId = String(user.schoolId || "");
  if (!schoolId) {
    return false;
  }

  const packages = await B2BPackageModel.find({ schoolId, status: "active" });
  return packages.some((pkg: any) =>
    matchesContentScope(
      {
        contentTypes: pkg.contentTypes,
        pathIds: pkg.pathIds,
        subjectIds: pkg.subjectIds,
      },
      contentType,
      pathId,
      subjectId,
    ),
  );
};

const getPackageContentTypeForQuizSource = (source?: string) => {
  if (source === "training") return "banks";
  if (source === "tests") return "tests";
  if (source === "foundation") return "foundation";
  if (source === "course") return "courses";
  return "";
};

const getLearningSlotForQuizSource = (source?: string) => {
  if (source === "training") return "training";
  if (source === "tests") return "tests";
  if (source === "foundation") return "foundation";
  if (source === "course") return "course";
  return "";
};

const getQuizPlacementAccessType = (quiz: any, source?: string) => {
  const slot = getLearningSlotForQuizSource(source);
  if (!slot) return "inherit";

  const placement = (Array.isArray(quiz.learningPlacements) ? quiz.learningPlacements : []).find(
    (item: any) => item?.slot === slot && item?.isVisible !== false,
  );

  return placement?.accessType || "inherit";
};

const getPaidQuizPackageContentTypes = (quiz: any, source?: string) => {
  const sourceContentType = getPackageContentTypeForQuizSource(source);
  if (sourceContentType) {
    return [sourceContentType];
  }

  const visibleSlots = new Set(
    (Array.isArray(quiz.learningPlacements) ? quiz.learningPlacements : [])
      .filter((placement: any) => placement?.isVisible !== false)
      .filter((placement: any) => !placement?.accessType || placement.accessType === "inherit" || placement.accessType === "paid")
      .map((placement: any) => String(placement?.slot || ""))
      .filter(Boolean),
  );
  const hasTrainingSlot =
    visibleSlots.has("training") ||
    quiz.showInTraining === true ||
    quiz.placement === "training" ||
    quiz.placement === "both" ||
    quiz.type === "bank";
  const hasTestSlot =
    visibleSlots.has("tests") ||
    quiz.showInMock === true ||
    quiz.placement === "mock" ||
    quiz.placement === "both" ||
    !hasTrainingSlot;

  const contentTypes = [];
  if (hasTrainingSlot) contentTypes.push("banks");
  if (hasTestSlot) contentTypes.push("tests");
  return contentTypes.length ? contentTypes : ["tests"];
};

const canSubmitQuiz = async (quiz: any, user: any, source?: string) => {
  if (isStaffRole(user.role)) {
    return true;
  }

  const isApproved = quiz.approvalStatus === "approved" || !quiz.approvalStatus;
  const isVisible = quiz.isPublished && quiz.showOnPlatform !== false && isApproved;
  if (!isVisible) {
    return false;
  }

  const pathId = String(quiz.pathId || "");
  if (pathId) {
    const activePathIds = await getActivePathIds();
    if (!activePathIds.includes(pathId)) {
      return false;
    }
  }

  const targetUserIds = new Set((quiz.targetUserIds || []).map(String));
  const targetGroupIds = new Set((quiz.targetGroupIds || []).map(String));
  const userGroupIds = (user.groupIds || []).map(String);
  const hasExplicitTarget = targetUserIds.size > 0 || targetGroupIds.size > 0;
  const isTargeted =
    !hasExplicitTarget ||
    targetUserIds.has(String(user.id || user._id)) ||
    userGroupIds.some((groupId: string) => targetGroupIds.has(groupId));

  if (!isTargeted) {
    return false;
  }

  const placementAccessType = getQuizPlacementAccessType(quiz, source);
  const accessType = placementAccessType !== "inherit" ? placementAccessType : quiz.access?.type || "free";
  if (accessType === "free") {
    return true;
  }

  if (user.subscription?.plan === "premium") {
    return true;
  }

  if (accessType === "private") {
    const allowedGroupIds = new Set((quiz.access?.allowedGroupIds || []).map(String));
    const matchesAllowedGroup =
      allowedGroupIds.size === 0 || userGroupIds.some((groupId: string) => allowedGroupIds.has(groupId));
    return hasExplicitTarget || matchesAllowedGroup;
  }

  const subjectId = String(quiz.subjectId || "");
  const purchasedPackageIds = (user.subscription?.purchasedPackages || []).map(String);

  if (accessType === "course_only") {
    return (
      (await hasPurchasedPackageAccess(purchasedPackageIds, "courses", pathId, subjectId)) ||
      (await hasSchoolPackageAccess(user, "courses", pathId, subjectId))
    );
  }

  const packageContentTypes = getPaidQuizPackageContentTypes(quiz, source);
  for (const contentType of packageContentTypes) {
    if (
      (await hasPurchasedPackageAccess(purchasedPackageIds, contentType, pathId, subjectId)) ||
      (await hasSchoolPackageAccess(user, contentType, pathId, subjectId))
    ) {
      return true;
    }
  }

  return false;
};

const updateSkillProgressFromResult = async (result: any, userId: string) => {
  const skillsAnalysis = Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : [];
  if (skillsAnalysis.length === 0) return;

  await Promise.all(
    skillsAnalysis
      .filter((skill: any) => skill?.skillId || skill?.skill)
      .map(async (skill: any) => {
        const skillId = String(skill.skillId || `${skill.subjectId || "subject"}:${skill.sectionId || "section"}:${skill.skill}`);
        const mastery = Math.max(0, Math.min(100, Number(skill.mastery || 0)));
        const existing = await SkillProgressModel.findOne({ userId, skillId });
        const previousAttempts = Number(existing?.attempts || 0);
        const nextAttempts = previousAttempts + 1;
        const previousMastery = Number(existing?.mastery || 0);
        const nextMastery = Math.round(((previousMastery * previousAttempts) + mastery) / nextAttempts);
        const nextStatus = buildSkillStatus(nextMastery);

        await SkillProgressModel.findOneAndUpdate(
          { userId, skillId },
          {
            userId,
            skillId,
            skill: String(skill.skill || existing?.skill || "مهارة غير مسماة"),
            pathId: String(skill.pathId || existing?.pathId || ""),
            subjectId: String(skill.subjectId || existing?.subjectId || ""),
            sectionId: String(skill.sectionId || existing?.sectionId || ""),
            mastery: nextMastery,
            status: nextStatus,
            attempts: nextAttempts,
            lastQuizId: String(result.quizId || ""),
            lastQuizTitle: String(result.quizTitle || ""),
            lastAttemptAt: new Date(),
            recommendedAction: buildRecommendedAction(nextMastery, nextAttempts),
          },
          { new: true, upsert: true },
        );
      }),
  );
};

const updateSkillProgressFromQuestionAttempt = async (attempt: any, userId: string) => {
  const skillIds = uniqueStrings(Array.isArray(attempt.skillIds) ? attempt.skillIds.map(String) : []);
  if (skillIds.length === 0) return;

  const skills = await SkillModel.find(buildDocumentsByIdsQuery(skillIds));
  const mastery = attempt.isCorrect ? 100 : 0;

  await Promise.all(
    skills.map(async (skill) => {
      const skillId = String(skill.id || skill._id);
      const existing = await SkillProgressModel.findOne({ userId, skillId });
      const previousAttempts = Number(existing?.attempts || 0);
      const nextAttempts = previousAttempts + 1;
      const previousMastery = Number(existing?.mastery || 0);
      const nextMastery = Math.round(((previousMastery * previousAttempts) + mastery) / nextAttempts);
      const nextStatus = buildSkillStatus(nextMastery);

      await SkillProgressModel.findOneAndUpdate(
        { userId, skillId },
        {
          userId,
          skillId,
          skill: String(skill.name || existing?.skill || "مهارة غير مسماة"),
          pathId: String(skill.pathId || existing?.pathId || attempt.pathId || ""),
          subjectId: String(skill.subjectId || existing?.subjectId || attempt.subjectId || ""),
          sectionId: String(skill.sectionId || existing?.sectionId || attempt.sectionId || ""),
          mastery: nextMastery,
          status: nextStatus,
          attempts: nextAttempts,
          lastQuizId: String(existing?.lastQuizId || ""),
          lastQuizTitle: String(existing?.lastQuizTitle || ""),
          lastAttemptAt: new Date(),
          recommendedAction: buildRecommendedAction(nextMastery, nextAttempts),
        },
        { new: true, upsert: true },
      );
    }),
  );
};

const matchesManagedScope = (
  gap: any,
  managedPathIds: Set<string>,
  managedSubjectIds: Set<string>,
) => {
  if (managedPathIds.size === 0 && managedSubjectIds.size === 0) {
    return true;
  }

  const gapSubjectId = String(gap?.subjectId || "");
  const gapPathId = String(gap?.pathId || "");

  if (managedSubjectIds.size > 0 && gapSubjectId && managedSubjectIds.has(gapSubjectId)) {
    return true;
  }

  if (managedPathIds.size > 0 && gapPathId && managedPathIds.has(gapPathId)) {
    return true;
  }

  return false;
};

const toSafeDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const STUDENT_DASHBOARD_SELECT = "id name email schoolId groupIds avatar isActive role";

const buildScopedStudentFilter = (authUser: any) => {
  const managedPathIds = new Set<string>((authUser.managedPathIds || []).map(String));
  const managedSubjectIds = new Set<string>((authUser.managedSubjectIds || []).map(String));

  if (authUser.role === "admin") {
    return { filter: { role: "student" }, managedPathIds, managedSubjectIds };
  }

  if (authUser.role === "teacher" || authUser.role === "supervisor") {
    const allowedGroupIds = new Set((authUser.groupIds || []).map(String));
    const scopeFilters: Record<string, unknown>[] = [];

    if (allowedGroupIds.size > 0) {
      scopeFilters.push({ groupIds: { $in: Array.from(allowedGroupIds) } });
    }
    if (authUser.schoolId) {
      scopeFilters.push({ schoolId: String(authUser.schoolId) });
    }

    return {
      filter: scopeFilters.length ? { role: "student", $or: scopeFilters } : { role: "student", _id: { $exists: false } },
      managedPathIds,
      managedSubjectIds,
    };
  }

  if (authUser.role === "parent") {
    const linkedStudentIds = uniqueStrings((authUser.linkedStudentIds || []).map(String));
    const studentIdentityFilter = linkedStudentIds.length ? buildDocumentsByIdsQuery(linkedStudentIds) : { _id: { $exists: false } };
    return {
      filter: { role: "student", ...studentIdentityFilter },
      managedPathIds,
      managedSubjectIds,
    };
  }

  return {
    filter: { role: "student", ...buildDocumentQuery(String(authUser.id || authUser._id || "")) },
    managedPathIds,
    managedSubjectIds,
  };
};

const resolveScopedStudents = async (authUser: any, options?: { limit?: number }) => {
  const { filter, managedPathIds, managedSubjectIds } = buildScopedStudentFilter(authUser);
  const limit = Math.max(1, Math.min(options?.limit || 500, 1000));
  const [students, totalStudents] = await Promise.all([
    UserModel.find(filter).select(STUDENT_DASHBOARD_SELECT).sort({ createdAt: -1 }).limit(limit).lean(),
    UserModel.countDocuments(filter),
  ]);

  return { students, totalStudents, isTruncated: totalStudents > students.length, managedPathIds, managedSubjectIds };
};

const filterResultsByManagedScope = (
  results: any[],
  role: string,
  managedPathIds: Set<string>,
  managedSubjectIds: Set<string>,
) => {
  if (role !== "teacher" || (managedPathIds.size === 0 && managedSubjectIds.size === 0)) {
    return results;
  }

  return results.filter((result) => {
    const skills = Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : [];
    return skills.some((gap: any) => matchesManagedScope(gap, managedPathIds, managedSubjectIds));
  });
};

export const quizRouter = Router();

quizRouter.use((req, _res, next) => {
  if (req.method !== "GET") {
    clearPublicQuizListCache();
    clearPublicQuestionSummaryCache();
  }
  next();
});

quizRouter.get(
  "/questions",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const query = questionListQuerySchema.parse(req.query);
    const canUseSummaryCache =
      query.summary &&
      query.noTotal &&
      !query.ids &&
      !query.search &&
      !query.approvalStatus &&
      !isStaffRole(req.authUser?.role);
    const summaryCacheKey = canUseSummaryCache ? buildQuestionSummaryCacheKey(query) : "";
    const summaryCacheItem = summaryCacheKey ? publicQuestionSummaryCache.get(summaryCacheKey) : undefined;
    if (summaryCacheItem && summaryCacheItem.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "private, max-age=30");
      res.setHeader("X-Question-Summary-Cache", "hit");
      res.setHeader("X-Has-More", String(summaryCacheItem.hasMore));
      res.setHeader("X-Page", String(query.page));
      res.setHeader("X-Limit", String(query.limit));
      return res.json(summaryCacheItem.payload);
    }

    let baseFilter: Record<string, any> = {};

    if (!isStaffRole(req.authUser?.role)) {
      const visibleQuizFilter = await withLearnerVisiblePaths(
        {
          isPublished: true,
          showOnPlatform: { $ne: false },
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
        },
        req.authUser,
      );
      const shouldExpandLinkedQuizQuestions = !query.summary || Boolean(query.ids) || Boolean(query.search);
      const linkedQuestionConditions: Record<string, any>[] = [];

      if (shouldExpandLinkedQuizQuestions) {
        const visibleQuizzes = await QuizModel.find(visibleQuizFilter).select("questionIds mockExam").lean();
        const linkedQuestionIds = uniqueStrings(
          visibleQuizzes.flatMap((quiz: any) => getQuizQuestionIds(quiz)),
        );
        const linkedObjectIds = linkedQuestionIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        if (linkedQuestionIds.length > 0) {
          linkedQuestionConditions.push({ id: { $in: linkedQuestionIds } });
        }
        if (linkedObjectIds.length > 0) {
          linkedQuestionConditions.push({ _id: { $in: linkedObjectIds } });
        }
      }

      baseFilter = {
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false } },
          { approvalStatus: null },
          ...linkedQuestionConditions,
        ],
      };
    }

    const scopeFilter: Record<string, any> = {};
    if (query.pathId) scopeFilter.pathId = query.pathId;
    if (query.ids) {
      const ids = uniqueStrings(query.ids.split(",").map((item) => item.trim()).filter(Boolean)).slice(0, 200);
      const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
      scopeFilter.$or = [
        ...(Array.isArray(scopeFilter.$or) ? scopeFilter.$or : []),
        { id: { $in: ids } },
        ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ];
    }
    if (query.subject) scopeFilter.subject = query.subject;
    if (query.sectionId) scopeFilter.sectionId = query.sectionId;
    if (query.skillId) scopeFilter.skillIds = query.skillId;
    if (query.approvalStatus && isStaffRole(req.authUser?.role)) scopeFilter.approvalStatus = query.approvalStatus;
    if (query.search) {
      scopeFilter.$or = [
        ...(Array.isArray(scopeFilter.$or) ? scopeFilter.$or : []),
        { text: { $regex: query.search, $options: "i" } },
        { explanation: { $regex: query.search, $options: "i" } },
        { id: { $regex: query.search, $options: "i" } },
      ];
    }

    const filterParts = [baseFilter, scopeFilter].filter((item) => Object.keys(item).length > 0);
    const filter = await withLearnerVisiblePaths(filterParts.length > 0 ? { $and: filterParts } : {}, req.authUser);
    const skip = (query.page - 1) * query.limit;
    const queryBuilder = QuestionModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.noTotal ? query.limit + 1 : query.limit)
      .lean();
    if (query.summary) {
      queryBuilder.select("id text imageUrl skillIds pathId subject sectionId difficulty type ownerType ownerId createdBy assignedTeacherId approvalStatus approvedBy approvedAt reviewerNotes revenueSharePercentage createdAt updatedAt");
    }

    const [rawItems, total] = await Promise.all([
      queryBuilder,
      query.noTotal ? Promise.resolve(null) : QuestionModel.countDocuments(filter),
    ]);
    const hasMore = query.noTotal && rawItems.length > query.limit;
    const limitedItems = query.noTotal ? rawItems.slice(0, query.limit) : rawItems;
    const canSeeAnswers = isStaffRole(req.authUser?.role);
    const items = query.summary
      ? limitedItems.map((item) => ({ ...item, text: toQuestionSummaryText(item.text) }))
      : canSeeAnswers
        ? limitedItems
        : limitedItems.map((item) => sanitizeQuestionForLearner(item as Record<string, any>));
    if (total !== null) {
      res.setHeader("X-Total-Count", String(total));
    }
    res.setHeader("X-Has-More", String(hasMore));
    res.setHeader("X-Page", String(query.page));
    res.setHeader("X-Limit", String(query.limit));
    if (summaryCacheKey) {
      if (publicQuestionSummaryCache.size >= QUESTION_SUMMARY_CACHE_MAX_ENTRIES) {
        const oldestKey = publicQuestionSummaryCache.keys().next().value;
        if (oldestKey) {
          publicQuestionSummaryCache.delete(oldestKey);
        }
      }
      publicQuestionSummaryCache.set(summaryCacheKey, {
        expiresAt: Date.now() + QUESTION_SUMMARY_CACHE_TTL_MS,
        payload: items,
        hasMore,
      });
      res.setHeader("Cache-Control", "private, max-age=30");
      res.setHeader("X-Question-Summary-Cache", "miss");
    }
    res.json(items);
  }),
);

quizRouter.post(
  "/questions",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = questionSchema.parse(req.body);
    await assertTeacherManagedScope(req.authUser!, payload);
    const workflowDefaults = getWorkflowDefaults(req.authUser!);
    const created = await QuestionModel.create({
      ...payload,
      ...workflowDefaults,
      approvalStatus:
        req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

quizRouter.patch(
  "/questions/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = questionBaseSchema.partial().parse(req.body);
    const documentQuery = buildOwnedDocumentQuery(req.params.id, req.authUser!);
    const existing = await QuestionModel.findOne(documentQuery);

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Question not found" });
    }

    const mergedPayload = questionSchema.parse({
      ...existing.toObject(),
      ...payload,
    });

    await assertTeacherManagedScope(req.authUser!, mergedPayload);
    const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);
    const updated = await QuestionModel.findOneAndUpdate(documentQuery, sanitizedPayload, { new: true });
    return res.json(updated);
  }),
);

quizRouter.delete(
  "/questions/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const deleted = await QuestionModel.findOneAndDelete(buildOwnedDocumentQuery(req.params.id, req.authUser!));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Question not found" });
    }

    return res.json({ success: true });
  }),
);

quizRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const canUsePublicCache = !isStaffRole(req.authUser?.role);
    if (canUsePublicCache && publicQuizListCache && publicQuizListCache.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "private, max-age=30");
      res.setHeader("X-Quiz-List-Cache", "hit");
      return res.json(publicQuizListCache.payload);
    }

    const baseFilter = isStaffRole(req.authUser?.role)
      ? {}
      : {
          isPublished: true,
          showOnPlatform: { $ne: false },
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
        };
    const filter = await withLearnerVisiblePaths(baseFilter, req.authUser);
    const pagination = resolvePagination(req.query, { limit: 200 });
    const [items, total] = await Promise.all([
      QuizModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      QuizModel.countDocuments(filter),
    ]);
    let safeItems = items;

    if (!isStaffRole(req.authUser?.role) && items.length > 0) {
      const allQuestionIds = uniqueStrings(items.flatMap((quiz: any) => getQuizQuestionIds(quiz).map(String)));
      const questions = allQuestionIds.length
        ? await QuestionModel.find(buildDocumentsByIdsQuery(allQuestionIds)).select("id text imageUrl options type").lean()
        : [];
      const usableById = new Map<string, boolean>();
      questions.forEach((question: any) => {
        const canonicalId = String(question.id || question._id);
        const usable = isQuestionContentUsable(question);
        usableById.set(canonicalId, usable);
        const withoutCopySuffix = canonicalId.replace(/_copy(?:_\d+)?$/i, "");
        if (withoutCopySuffix && withoutCopySuffix !== canonicalId) {
          usableById.set(withoutCopySuffix, usable);
        }
      });

      safeItems = items.filter((quiz: any) =>
        getQuizQuestionIds(quiz).some((questionId: string) => usableById.get(String(questionId)) === true),
      );
    }

    const payload = {
      quizzes: safeItems,
      pagination: buildPaginatedResponse([], pagination, isStaffRole(req.authUser?.role) ? total : safeItems.length),
    };
    if (canUsePublicCache) {
      publicQuizListCache = {
        expiresAt: Date.now() + PUBLIC_QUIZ_LIST_CACHE_TTL_MS,
        payload,
      };
      res.setHeader("Cache-Control", "private, max-age=30");
      res.setHeader("X-Quiz-List-Cache", "miss");
    }
    res.json(payload);
  }),
);

quizRouter.get(
  "/analytics/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = dashboardAnalyticsQuerySchema.parse(req.query);
    const authUser = await UserModel.findById(req.authUser!.id);

    if (!authUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    const { students: scopedStudents, totalStudents, isTruncated, managedPathIds, managedSubjectIds } =
      await resolveScopedStudents(authUser, { limit: query.studentLimit });

    const scopedStudentIds = scopedStudents.map((student) => idOf(student));
    const relatedGroupIds = uniqueStrings([
      ...scopedStudents.flatMap((student) => (student.groupIds || []).map(String)),
      ...(authUser.groupIds || []).map(String),
      authUser.schoolId ? String(authUser.schoolId) : undefined,
    ]);

    const groups = relatedGroupIds.length
      ? await GroupModel.find(buildDocumentsByIdsQuery(relatedGroupIds)).select("id name").lean()
      : [];

    const groupNameById = new Map(groups.map((group: any) => [idOf(group), String(group.name || "")]));

    let quizResults = scopedStudentIds.length
      ? await QuizResultModel.find({ userId: { $in: scopedStudentIds } }).sort({ createdAt: -1 }).limit(query.resultLimit).lean()
      : [];

    if (authUser.role === "teacher" && (managedPathIds.size > 0 || managedSubjectIds.size > 0)) {
      quizResults = quizResults.filter((result) => {
        const skills = Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : [];
        return skills.some((gap: any) => matchesManagedScope(gap, managedPathIds, managedSubjectIds));
      });
    }

    let questionAttempts = scopedStudentIds.length
      ? await QuestionAttemptModel.find({ userId: { $in: scopedStudentIds } }).sort({ createdAt: -1 }).limit(query.attemptLimit).lean()
      : [];

    if (authUser.role === "teacher" && (managedPathIds.size > 0 || managedSubjectIds.size > 0)) {
      questionAttempts = questionAttempts.filter((attempt) => matchesManagedScope(attempt, managedPathIds, managedSubjectIds));
    }

    const attemptSkillIds = uniqueStrings(questionAttempts.flatMap((attempt) => (attempt.skillIds || []).map(String)));
    const attemptSkills = attemptSkillIds.length ? await SkillModel.find(buildDocumentsByIdsQuery(attemptSkillIds)).lean() : [];
    const skillById = new Map(attemptSkills.map((skill: any) => [idOf(skill), skill]));
    const attemptSubjectIds = uniqueStrings([
      ...questionAttempts.map((attempt) => String(attempt.subjectId || "")),
      ...attemptSkills.map((skill) => String(skill.subjectId || "")),
    ]);
    const attemptSectionIds = uniqueStrings([
      ...questionAttempts.map((attempt) => String(attempt.sectionId || "")),
      ...attemptSkills.map((skill) => String(skill.sectionId || "")),
    ]);
    const attemptSubjects = attemptSubjectIds.length ? await SubjectModel.find(buildDocumentsByIdsQuery(attemptSubjectIds)).select("id name").lean() : [];
    const attemptSections = attemptSectionIds.length ? await SectionModel.find(buildDocumentsByIdsQuery(attemptSectionIds)).select("id name").lean() : [];
    const subjectNameById = new Map(attemptSubjects.map((subject: any) => [idOf(subject), String(subject.name || "")]));
    const sectionNameById = new Map(attemptSections.map((section: any) => [idOf(section), String(section.name || "")]));
    const attemptsByStudent = new Map<string, any[]>();
    questionAttempts.forEach((attempt) => {
      const key = String(attempt.userId || "");
      const bucket = attemptsByStudent.get(key) || [];
      bucket.push(attempt);
      attemptsByStudent.set(key, bucket);
    });

    const buildAttemptGaps = (attempt: any) =>
      (Array.isArray(attempt.skillIds) ? attempt.skillIds : [])
        .map((skillId: unknown) => {
          const resolvedSkill = skillById.get(String(skillId));
          if (!resolvedSkill) return null;

          return {
            skillId: String(resolvedSkill.id || resolvedSkill._id || skillId),
            skill: String(resolvedSkill.name || "مهارة غير مسماة"),
            pathId: String(resolvedSkill.pathId || attempt.pathId || ""),
            subjectId: String(resolvedSkill.subjectId || attempt.subjectId || ""),
            sectionId: String(resolvedSkill.sectionId || attempt.sectionId || ""),
            subjectName: subjectNameById.get(String(resolvedSkill.subjectId || attempt.subjectId || "")) || "",
            section: sectionNameById.get(String(resolvedSkill.sectionId || attempt.sectionId || "")) || String(resolvedSkill.sectionId || attempt.sectionId || ""),
            mastery: attempt.isCorrect ? 100 : 0,
          };
        })
        .filter(Boolean);

    const resultsByStudent = new Map<string, any[]>();
    quizResults.forEach((result) => {
      const key = String(result.userId || "");
      const bucket = resultsByStudent.get(key) || [];
      bucket.push(result);
      resultsByStudent.set(key, bucket);
    });

    const weakestStudents = scopedStudents
      .map((student) => {
        const studentId = idOf(student);
        const results = resultsByStudent.get(studentId) || [];
        const granularAttempts = attemptsByStudent.get(studentId) || [];
        const attempts = results.length;
        const granularAnswered = granularAttempts.filter((attempt) => Number(attempt.selectedOptionIndex ?? -1) >= 0);
        const granularAverage = granularAnswered.length
          ? Math.round((granularAnswered.filter((attempt) => Boolean(attempt.isCorrect)).length / granularAnswered.length) * 100)
          : 0;
        const averageScore = attempts
          ? Math.round(results.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / attempts)
          : granularAverage;

        const weakSkillMap = new Map<string, { skill: string; masterySum: number; count: number }>();

        results.forEach((result) => {
          const skills = (Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : []).filter((gap: any) =>
            authUser.role === "teacher"
              ? matchesManagedScope(gap, managedPathIds, managedSubjectIds)
              : true,
          );
          skills.forEach((gap: any) => {
            const mastery = Number(gap?.mastery || 0);
            if (mastery >= 75) return;
            const key = String(gap?.skillId || gap?.skill || gap?.sectionId || "unknown");
            const current = weakSkillMap.get(key) || {
              skill: String(gap?.skill || "مهارة غير مسماة"),
              masterySum: 0,
              count: 0,
            };
            current.masterySum += mastery;
            current.count += 1;
            weakSkillMap.set(key, current);
          });
        });

        granularAttempts.forEach((attempt) => {
          buildAttemptGaps(attempt).forEach((gap: any) => {
            const mastery = Number(gap?.mastery || 0);
            if (mastery >= 75) return;
            const key = String(gap?.skillId || gap?.skill || gap?.sectionId || "unknown");
            const current = weakSkillMap.get(key) || {
              skill: String(gap?.skill || "مهارة غير مسماة"),
              masterySum: 0,
              count: 0,
            };
            current.masterySum += mastery;
            current.count += 1;
            weakSkillMap.set(key, current);
          });
        });

        const reliableWeakSkillItems = Array.from(weakSkillMap.values()).filter((item) => item.count >= MIN_ANALYTICS_SKILL_EVIDENCE_COUNT);
        const earlyWeakSignalCount = Array.from(weakSkillMap.values()).filter((item) => item.count < MIN_ANALYTICS_SKILL_EVIDENCE_COUNT).length;
        const weakestSkills = reliableWeakSkillItems
          .map((item) => ({
            skill: item.skill,
            mastery: Math.round(item.masterySum / Math.max(item.count, 1)),
            attempts: item.count,
            isReliable: true,
            evidenceThreshold: MIN_ANALYTICS_SKILL_EVIDENCE_COUNT,
          }))
          .sort((a, b) => a.mastery - b.mastery)
          .slice(0, 3);

        return {
          id: studentId,
          name: student.name,
          email: student.email,
          schoolId: student.schoolId || undefined,
          schoolName: student.schoolId ? groupNameById.get(String(student.schoolId)) : undefined,
          groupIds: (student.groupIds || []).map(String),
          groupNames: (student.groupIds || []).map((groupId) => groupNameById.get(String(groupId))).filter(Boolean),
          attempts,
          questionAttempts: granularAttempts.length,
          averageScore,
          weakSkillCount: reliableWeakSkillItems.length,
          earlyWeakSignalCount,
          weakestSkills,
          latestAttemptAt: toSafeDate(results[0]?.createdAt),
          recommendedAction:
            attempts === 0
              ? "ابدأ باختبار تشخيصي موجه لهذه الحالة"
              : averageScore < 50
                ? "أرسل خطة علاج عاجلة واختبار متابعة موجه"
                : averageScore < 70
                  ? "أضف تدريبات علاجية واختبار ساهر مخصص"
                  : "استمر في التثبيت والمتابعة الدورية",
        };
      })
      .sort((a, b) => a.averageScore - b.averageScore || b.weakSkillCount - a.weakSkillCount)
      .slice(0, 12);

    const weakSkillMap = new Map<
      string,
      {
        skillId?: string;
        skill: string;
        subjectId?: string;
        sectionId?: string;
        section?: string;
        masterySum: number;
        attempts: number;
        studentIds: Set<string>;
      }
    >();

    quizResults.forEach((result) => {
      const skills = (Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : []).filter((gap: any) =>
        authUser.role === "teacher"
          ? matchesManagedScope(gap, managedPathIds, managedSubjectIds)
          : true,
      );
      skills.forEach((gap: any) => {
        const mastery = Number(gap?.mastery || 0);
        if (mastery >= 75) return;

        const key = String(gap?.skillId || gap?.skill || gap?.sectionId || "unknown");
        const current = weakSkillMap.get(key) || {
          skillId: gap?.skillId,
          skill: String(gap?.skill || "مهارة غير مسماة"),
          subjectId: gap?.subjectId,
          sectionId: gap?.sectionId,
          section: gap?.section,
          masterySum: 0,
          attempts: 0,
          studentIds: new Set<string>(),
        };

        current.masterySum += mastery;
        current.attempts += 1;
        current.studentIds.add(String(result.userId || ""));
        weakSkillMap.set(key, current);
      });
    });

    questionAttempts.forEach((attempt) => {
      buildAttemptGaps(attempt).forEach((gap: any) => {
        const mastery = Number(gap?.mastery || 0);
        if (mastery >= 75) return;

        const key = String(gap?.skillId || gap?.skill || gap?.sectionId || "unknown");
        const current = weakSkillMap.get(key) || {
          skillId: gap?.skillId,
          skill: String(gap?.skill || "مهارة غير مسماة"),
          subjectId: gap?.subjectId,
          sectionId: gap?.sectionId,
          section: gap?.section,
          masterySum: 0,
          attempts: 0,
          studentIds: new Set<string>(),
        };

        current.masterySum += mastery;
        current.attempts += 1;
        current.studentIds.add(String(attempt.userId || ""));
        weakSkillMap.set(key, current);
      });
    });

    const earlyWeakSkillSignalCount = Array.from(weakSkillMap.values()).filter((item) => item.attempts < MIN_ANALYTICS_SKILL_EVIDENCE_COUNT).length;
    const weakestSkills = Array.from(weakSkillMap.values())
      .filter((item) => item.attempts >= MIN_ANALYTICS_SKILL_EVIDENCE_COUNT)
      .map((item) => {
        const mastery = Math.round(item.masterySum / Math.max(item.attempts, 1));
        return {
          skillId: item.skillId,
          skill: item.skill,
          subjectId: item.subjectId,
          sectionId: item.sectionId,
          section: item.section,
          mastery,
          attempts: item.attempts,
          isReliable: true,
          evidenceThreshold: MIN_ANALYTICS_SKILL_EVIDENCE_COUNT,
          affectedStudents: item.studentIds.size,
          recommendedAction: buildRecommendedAction(mastery, item.attempts),
        };
      })
      .sort((a, b) => a.mastery - b.mastery || b.affectedStudents - a.affectedStudents)
      .slice(0, 12);

    const subjectMap = new Map<
      string,
      {
        subjectId?: string;
        subjectName: string;
        masterySum: number;
        count: number;
        weakStudents: Set<string>;
      }
    >();

    quizResults.forEach((result) => {
      const skills = (Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : []).filter((gap: any) =>
        authUser.role === "teacher"
          ? matchesManagedScope(gap, managedPathIds, managedSubjectIds)
          : true,
      );
      skills.forEach((gap: any) => {
        if (!gap?.subjectId && !gap?.subjectName && !result.quizTitle) return;
        const key = String(gap?.subjectId || gap?.subjectName || result.quizTitle);
        const current = subjectMap.get(key) || {
          subjectId: gap?.subjectId,
          subjectName: String(gap?.subjectName || result.quizTitle || "مادة غير مسماة"),
          masterySum: 0,
          count: 0,
          weakStudents: new Set<string>(),
        };

        current.masterySum += Number(gap?.mastery || 0);
        current.count += 1;
        if (Number(gap?.mastery || 0) < 75) {
          current.weakStudents.add(String(result.userId || ""));
        }
        subjectMap.set(key, current);
      });
    });

    questionAttempts.forEach((attempt) => {
      buildAttemptGaps(attempt).forEach((gap: any) => {
        if (!gap?.subjectId) return;
        const key = String(gap.subjectId);
        const current = subjectMap.get(key) || {
          subjectId: gap.subjectId,
          subjectName: String(gap.subjectName || subjectNameById.get(String(gap.subjectId)) || "مادة غير مسماة"),
          masterySum: 0,
          count: 0,
          weakStudents: new Set<string>(),
        };

        current.masterySum += Number(gap.mastery || 0);
        current.count += 1;
        if (Number(gap.mastery || 0) < 75) {
          current.weakStudents.add(String(attempt.userId || ""));
        }
        subjectMap.set(key, current);
      });
    });

    const subjectSummaries = Array.from(subjectMap.values())
      .map((item) => ({
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        mastery: Math.round(item.masterySum / Math.max(item.count, 1)),
        weakStudents: item.weakStudents.size,
      }))
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 10);

    let assignedFollowUps = await QuizModel.find({
      isPublished: true,
      mode: { $in: ["saher", "central"] },
      $or: [
        { targetUserIds: { $in: scopedStudentIds } },
        { targetGroupIds: { $in: relatedGroupIds } },
      ],
    }).sort({ createdAt: -1 }).limit(12).lean();

    if (authUser.role === "teacher" && (managedPathIds.size > 0 || managedSubjectIds.size > 0)) {
      assignedFollowUps = assignedFollowUps.filter((quiz) => {
        const quizPathId = String(quiz.pathId || "");
        const quizSubjectId = String(quiz.subjectId || "");

        if (managedSubjectIds.size > 0 && quizSubjectId && managedSubjectIds.has(quizSubjectId)) {
          return true;
        }

        if (managedPathIds.size > 0 && quizPathId && managedPathIds.has(quizPathId)) {
          return true;
        }

        return false;
      });
    }

    return res.json({
      scope: {
        role: authUser.role,
        studentCount: totalStudents,
        sampledStudentCount: scopedStudents.length,
        isTruncated,
        groupCount: relatedGroupIds.length,
        quizAttempts: quizResults.length,
        questionAttempts: questionAttempts.length,
        earlyWeakSkillSignalCount,
        minSkillEvidence: MIN_ANALYTICS_SKILL_EVIDENCE_COUNT,
        limits: {
          studentLimit: query.studentLimit,
          resultLimit: query.resultLimit,
          attemptLimit: query.attemptLimit,
        },
      },
      weakestStudents,
      weakestSkills,
      subjectSummaries,
      assignedFollowUps: assignedFollowUps.map((quiz) => ({
        id: String(quiz.id),
        title: quiz.title,
        mode: quiz.mode || "regular",
        pathId: quiz.pathId,
        subjectId: quiz.subjectId,
        targetGroupIds: quiz.targetGroupIds || [],
        targetUserIds: quiz.targetUserIds || [],
        dueDate: quiz.dueDate || undefined,
      })),
    });
  }),
);

quizRouter.get(
  "/results",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = quizResultsListQuerySchema.parse(req.query);
    const includeReview = String(req.query.includeReview || "").toLowerCase() === "true";
    const canUseShortCache = !includeReview && query.noTotal;
    const cacheKey = buildQuizResultsCacheKey(req.authUser!.id, req.originalUrl || req.url || "/results", includeReview);
    if (canUseShortCache) {
      const cached = quizResultsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.setHeader("X-Quiz-Results-Cache", "hit");
        return res.json(cached.payload);
      }
      if (cached) {
        quizResultsCache.delete(cacheKey);
      }
      res.setHeader("X-Quiz-Results-Cache", "miss");
    }
    const pagination = resolvePagination(query, { page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = { userId: req.authUser!.id };
    if (query.quizId) {
      filter.quizId = query.quizId;
    }
    if (query.status) {
      filter.passed = query.status === "passed";
    }
    if (query.search) {
      filter.quizTitle = { $regex: escapeRegex(query.search), $options: "i" };
    }
    const createdAtRange: Record<string, Date> = {};
    const dateFrom = parseDateFilter(query.dateFrom);
    const dateTo = parseDateFilter(query.dateTo);
    if (dateFrom) {
      createdAtRange.$gte = dateFrom;
    }
    if (dateTo) {
      createdAtRange.$lte = dateTo;
    }
    if (Object.keys(createdAtRange).length > 0) {
      filter.createdAt = createdAtRange;
    }
    const sortDirection = query.sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [query.sortBy]: sortDirection };
    if (query.sortBy !== "createdAt") {
      sort.createdAt = -1;
    }
    const projection = includeReview
      ? null
      : "id userId quizId quizTitle score passed attemptNumber source totalQuestions correctAnswers wrongAnswers unanswered timeSpentSeconds timeSpent date skillsAnalysis createdAt updatedAt";
    const resultsQuery = QuizResultModel.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);
    if (projection) {
      resultsQuery.select(projection);
    }
    const items = await resultsQuery.lean();
    const total = query.noTotal
      ? pagination.skip + items.length + (items.length === pagination.limit ? 1 : 0)
      : await QuizResultModel.countDocuments(filter);
    const payload = {
      results: items,
      pagination: buildPaginatedResponse([], pagination, total),
    };
    if (canUseShortCache) {
      quizResultsCache.set(cacheKey, {
        expiresAt: Date.now() + QUIZ_RESULTS_CACHE_TTL_MS,
        payload,
      });
      trimQuizResultsCacheIfNeeded();
    }
    res.json(payload);
  }),
);

quizRouter.get(
  "/results/scoped",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = quizResultsListQuerySchema.parse(req.query);
    const authUser = await UserModel.findById(req.authUser!.id);

    if (!authUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    const pagination = resolvePagination(query, { page: query.page, limit: query.limit });
    const includeReview = String(req.query.includeReview || "").toLowerCase() === "true";
    const projection = includeReview
      ? null
      : "id userId quizId quizTitle score passed attemptNumber source totalQuestions correctAnswers wrongAnswers unanswered timeSpentSeconds timeSpent date skillsAnalysis createdAt updatedAt pathId subjectId sectionId";
    const { students, totalStudents, managedPathIds, managedSubjectIds } = await resolveScopedStudents(authUser, {
      limit: Math.max(pagination.limit, 200),
    });
    const studentIds = students.map((student) => idOf(student));
    const studentById = new Map(students.map((student) => [idOf(student), student]));

    const scopedFilter: Record<string, unknown> = {};
    if (query.quizId) {
      scopedFilter.quizId = query.quizId;
    }
    if (query.status) {
      scopedFilter.passed = query.status === "passed";
    }
    if (query.search) {
      scopedFilter.quizTitle = { $regex: escapeRegex(query.search), $options: "i" };
    }
    const scopedCreatedAtRange: Record<string, Date> = {};
    const scopedDateFrom = parseDateFilter(query.dateFrom);
    const scopedDateTo = parseDateFilter(query.dateTo);
    if (scopedDateFrom) {
      scopedCreatedAtRange.$gte = scopedDateFrom;
    }
    if (scopedDateTo) {
      scopedCreatedAtRange.$lte = scopedDateTo;
    }
    if (Object.keys(scopedCreatedAtRange).length > 0) {
      scopedFilter.createdAt = scopedCreatedAtRange;
    }
    const sortDirection = query.sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [query.sortBy]: sortDirection };
    if (query.sortBy !== "createdAt") {
      sort.createdAt = -1;
    }

    let results: any[] = [];
    let selectedStudentIds = studentIds;
    if (query.studentId) {
      selectedStudentIds = studentIds.includes(query.studentId) ? [query.studentId] : [];
    }
    if (selectedStudentIds.length) {
      const scopedResultsQuery = QuizResultModel.find({
        userId: { $in: selectedStudentIds },
        ...scopedFilter,
      })
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit);
      if (projection) {
        scopedResultsQuery.select(projection);
      }
      results = await scopedResultsQuery.lean();
    }
    const total = selectedStudentIds.length
      ? (query.noTotal
        ? pagination.skip + results.length + (results.length === pagination.limit ? 1 : 0)
        : await QuizResultModel.countDocuments({
            userId: { $in: selectedStudentIds },
            ...scopedFilter,
          }))
      : 0;
    results = filterResultsByManagedScope(results, authUser.role, managedPathIds, managedSubjectIds);

    return res.json({
      scope: {
        role: authUser.role,
        studentCount: totalStudents,
        sampledStudentCount: students.length,
        resultCount: results.length,
      },
      pagination: buildPaginatedResponse([], pagination, total),
      results: results.map((result) => {
        const student = studentById.get(String(result.userId || ""));
        return {
          ...result,
          studentName: student?.name || "",
          studentEmail: student?.email || "",
          studentSchoolId: student?.schoolId || undefined,
          studentGroupIds: student?.groupIds || [],
        };
      }),
    });
  }),
);

quizRouter.get(
  "/skill-progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    const filter = { userId: req.authUser!.id };
    const pagination = resolvePagination(req.query, { limit: 80 });
    const [items, total] = await Promise.all([
      SkillProgressModel.find(filter).sort({ mastery: 1, lastAttemptAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      SkillProgressModel.countDocuments(filter),
    ]);
    res.json({
      skillProgress: items,
      pagination: buildPaginatedResponse([], pagination, total),
    });
  }),
);

quizRouter.get(
  "/question-attempts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const filter = { userId: req.authUser!.id };
    const pagination = resolvePagination(req.query, { limit: 100 });
    const [items, total] = await Promise.all([
      QuestionAttemptModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      QuestionAttemptModel.countDocuments(filter),
    ]);
    res.json({
      questionAttempts: items,
      pagination: buildPaginatedResponse([], pagination, total),
    });
  }),
);

quizRouter.post(
  "/question-attempts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = questionAttemptSchema.parse(req.body);
    const question = await QuestionModel.findOne(buildDocumentQuery(payload.questionId)).select(
      "id pathId subject sectionId skillIds correctOptionIndex",
    );

    if (!question) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Question not found" });
    }

    const selectedOptionIndex = Number(payload.selectedOptionIndex);
    const isCorrect =
      selectedOptionIndex >= 0 && selectedOptionIndex === Number(question.correctOptionIndex ?? 0);
    const created = await QuestionAttemptModel.create({
      ...payload,
      selectedOptionIndex,
      isCorrect,
      userId: req.authUser!.id,
      date: payload.date || new Date().toISOString(),
      pathId: String(question?.pathId || ""),
      subjectId: String(question?.subject || ""),
      sectionId: String(question?.sectionId || ""),
      skillIds: Array.isArray(question?.skillIds) ? question.skillIds.map(String) : [],
    });
    await updateSkillProgressFromQuestionAttempt(created, req.authUser!.id);

    res.status(StatusCodes.CREATED).json(created);
  }),
);

quizRouter.get(
  "/results/latest",
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await QuizResultModel.findOne({ userId: req.authUser!.id }).sort({ createdAt: -1 });

    if (!item) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "No quiz results found" });
    }

    return res.json(item);
  }),
);

quizRouter.post(
  "/",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = normalizeQuizPlacementPayload(quizSchema.parse(req.body));
    await assertTeacherManagedScope(req.authUser!, payload);
    const resolvedSkillIds = await resolveQuizSkillIds(getQuizQuestionIds(payload));
    const workflowDefaults = getWorkflowDefaults(req.authUser!);
    const willBePublished = req.authUser?.role === "admin" ? Boolean(payload.isPublished) : false;
    if (willBePublished) {
      const integrity = await validateQuizQuestionIntegrity(payload);
      if (!integrity.ok) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: integrity.message,
          integrity: {
            totalReferenced: integrity.totalReferenced,
            resolved: integrity.resolved,
            missingIds: integrity.missingIds.slice(0, 20),
            invalidContentIds: integrity.invalidContentIds.slice(0, 20),
          },
        });
      }
    }
    const created = await QuizModel.create({
      ...payload,
      ...workflowDefaults,
      approvalStatus:
        req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
      isPublished: req.authUser?.role === "admin" ? payload.isPublished : false,
      showOnPlatform: typeof payload.showOnPlatform === "boolean" ? payload.showOnPlatform : false,
      skillIds: resolvedSkillIds,
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

quizRouter.post(
  "/:id/submit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = quizSubmitSchema.parse(req.body);
    const quiz = await QuizModel.findOne(buildDocumentQuery(req.params.id));

    if (!quiz) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
    }

    const authUser = await UserModel.findById(req.authUser!.id);
    if (!authUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    if (!(await canSubmitQuiz(quiz, authUser, payload.source))) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot submit this quiz" });
    }

    const quizWindow = assertQuizWindowIsOpen(quiz, payload);
    if (quizWindow.ok === false) {
      return res.status(quizWindow.status).json({ message: quizWindow.message });
    }

    const quizId = String(quiz.id || quiz._id);
    const maxAttempts = getQuizMaxAttempts(quiz);
    const previousAttempts = await QuizResultModel.countDocuments({
      userId: req.authUser!.id,
      quizId,
    });

    if (previousAttempts >= maxAttempts) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Quiz attempt limit reached",
        maxAttempts,
        attemptsUsed: previousAttempts,
      });
    }

    const attemptNumber = previousAttempts + 1;
    const submissionKey = buildSubmissionKey(req.authUser!.id, quizId, attemptNumber);
    const questionIds = getQuizQuestionIds(quiz);
    const questions = questionIds.length ? await QuestionModel.find(buildDocumentsByIdsQuery(questionIds)) : [];
    const questionById = new Map<string, any>();
    questions.forEach((question) => {
      const canonicalId = String(question.id || question._id);
      questionById.set(canonicalId, question);
      const withoutCopySuffix = canonicalId.replace(/_copy(?:_\d+)?$/i, "");
      if (withoutCopySuffix && withoutCopySuffix !== canonicalId) {
        questionById.set(withoutCopySuffix, question);
      }
    });

    const orderedQuestions = questionIds
      .map((questionId) => {
        const id = String(questionId);
        return questionById.get(id) || questionById.get(id.replace(/_copy(?:_\d+)?$/i, ""));
      })
      .filter(Boolean);

    if (orderedQuestions.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Quiz has no valid questions" });
    }

    const skillIds = uniqueStrings(orderedQuestions.flatMap((question) => (question.skillIds || []).map(String)));
    const [skills, subjects, sections] = await Promise.all([
      skillIds.length ? SkillModel.find(buildDocumentsByIdsQuery(skillIds)) : [],
      SubjectModel.find(),
      SectionModel.find(),
    ]);
    const skillById = new Map<string, any>(
      skills.map((skill: any) => [String(skill.id || skill._id), skill] as [string, any]),
    );
    const subjectNameById = new Map(subjects.map((subject) => [String(subject.id || subject._id), String(subject.name || "")]));
    const sectionNameById = new Map(sections.map((section) => [String(section.id || section._id), String(section.name || "")]));

    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unanswered = 0;
    const skillStats = new Map<string, { total: number; correct: number }>();

    const questionReview = orderedQuestions.map((question) => {
      const questionId = String(question.id || question._id);
      const rawSelected = payload.answers[questionId];
      const selectedOptionIndex = typeof rawSelected === "number" && rawSelected >= 0 ? rawSelected : undefined;
      const isCorrect = selectedOptionIndex === Number(question.correctOptionIndex ?? 0);

      if (selectedOptionIndex === undefined) {
        unanswered += 1;
      } else if (isCorrect) {
        correctAnswers += 1;
      } else {
        wrongAnswers += 1;
      }

      (question.skillIds || []).map(String).filter(Boolean).forEach((skillId: string) => {
        const current = skillStats.get(skillId) || { total: 0, correct: 0 };
        current.total += 1;
        if (isCorrect) {
          current.correct += 1;
        }
        skillStats.set(skillId, current);
      });

      return {
        questionId,
        text: String(question.text || ""),
        options: Array.isArray(question.options) ? question.options.map(String) : [],
        correctOptionIndex: Number(question.correctOptionIndex ?? 0),
        selectedOptionIndex,
        explanation: question.explanation || "",
        videoUrl: question.videoUrl || "",
        imageUrl: question.imageUrl || "",
        isCorrect,
      };
    });

    const skillsAnalysis = Array.from(skillStats.entries()).map(([skillId, stats]) => {
      const skill = skillById.get(skillId);
      const mastery = Math.round((stats.correct / Math.max(stats.total, 1)) * 100);
      const status = buildResultSkillStatus(mastery);
      const subjectId = String(skill?.subjectId || quiz.subjectId || "");
      const sectionId = String(skill?.sectionId || quiz.sectionId || "");

      return {
        skillId,
        pathId: String(skill?.pathId || quiz.pathId || ""),
        subjectId,
        sectionId,
        skill: String(skill?.name || "مهارة غير مسماة"),
        mastery,
        status,
        recommendation: buildSkillRecommendation(mastery),
        section: sectionNameById.get(sectionId) || subjectNameById.get(subjectId) || "",
      };
    });

    const totalQuestions = orderedQuestions.length;
    const score = Math.round((correctAnswers / Math.max(totalQuestions, 1)) * 100);
    const passingScore = getQuizPassingScore(quiz);
    const timeSpentMinutes = Math.max(0, Math.round(payload.timeSpentSeconds / 60));
    let result;
    try {
      result = await QuizResultModel.create({
        userId: req.authUser!.id,
        quizId,
        quizTitle: String(quiz.title || "اختبار"),
        score,
        passed: score >= passingScore,
        attemptNumber,
        source: payload.source || "",
        totalQuestions,
        correctAnswers,
        wrongAnswers,
        unanswered,
        timeSpentSeconds: payload.timeSpentSeconds,
        timeSpent: timeSpentMinutes > 0 ? `${timeSpentMinutes} دقيقة` : "أقل من دقيقة",
        date: new Date().toISOString(),
        skillsAnalysis,
        questionReview,
        submissionKey,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        return res.status(StatusCodes.CONFLICT).json({
          message: "Quiz submission already processed",
          maxAttempts,
          attemptsUsed: attemptNumber,
        });
      }
      throw error;
    }

    await updateSkillProgressFromResult(result, req.authUser!.id);
    clearQuizResultsCache();
    return res.status(StatusCodes.CREATED).json(result);
  }),
);

quizRouter.patch(
  "/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = quizSchema.partial().parse(req.body);
    const documentQuery = buildOwnedDocumentQuery(req.params.id, req.authUser!);
    const existing = await QuizModel.findOne(documentQuery);

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
    }

    await assertTeacherManagedScope(req.authUser!, {
      ...existing.toObject(),
      ...payload,
    });
    const resolvedSkillIds = payload.questionIds || payload.mockExam
      ? await resolveQuizSkillIds(getQuizQuestionIds({ ...existing.toObject(), ...payload }))
      : undefined;
    const normalizedPayload = normalizeQuizPlacementPayload(payload, String(existing.type || "quiz"));
    const sanitizedPayload = sanitizeWorkflowUpdate(
      {
        ...normalizedPayload,
        ...(resolvedSkillIds ? { skillIds: resolvedSkillIds } : {}),
      } as Record<string, unknown>,
      req.authUser!,
      { respectPublished: true },
    );
    const nextQuizState = {
      ...existing.toObject(),
      ...normalizedPayload,
      ...sanitizedPayload,
    };
    if (nextQuizState.isPublished === true) {
      const integrity = await validateQuizQuestionIntegrity(nextQuizState);
      if (!integrity.ok) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: integrity.message,
          integrity: {
            totalReferenced: integrity.totalReferenced,
            resolved: integrity.resolved,
            missingIds: integrity.missingIds.slice(0, 20),
            invalidContentIds: integrity.invalidContentIds.slice(0, 20),
          },
        });
      }
    }
    const updated = await QuizModel.findOneAndUpdate(documentQuery, sanitizedPayload, { new: true });
    return res.json(updated);
  }),
);

quizRouter.get(
  "/integrity-report",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 50), 200));
    const quizzes = await QuizModel.find({ isPublished: true }).sort({ updatedAt: -1 }).limit(limit).lean();
    const issues: Array<Record<string, unknown>> = [];

    for (const quiz of quizzes) {
      const integrity = await validateQuizQuestionIntegrity(quiz);
      if (!integrity.ok) {
        issues.push({
          quizId: String(quiz.id || quiz._id || ""),
          title: String(quiz.title || ""),
          pathId: String(quiz.pathId || ""),
          subjectId: String(quiz.subjectId || ""),
          totalReferenced: integrity.totalReferenced,
          resolved: integrity.resolved,
          missingIds: integrity.missingIds,
          invalidContentIds: integrity.invalidContentIds,
        });
      }
    }

    res.json({
      scanned: quizzes.length,
      affected: issues.length,
      issues,
    });
  }),
);

quizRouter.post(
  "/integrity-repair",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const dryRun = req.query.dryRun !== "false";
    const limit = Math.max(1, Math.min(Number(req.query.limit || 200), 1000));
    const quizzes = await QuizModel.find({ isPublished: true }).sort({ updatedAt: -1 }).limit(limit).lean();

    const actions: Array<Record<string, unknown>> = [];
    let scanned = 0;
    let affected = 0;
    let unpublished = 0;

    for (const quiz of quizzes) {
      scanned += 1;
      const integrity = await validateQuizQuestionIntegrity(quiz);
      if (integrity.ok) continue;
      affected += 1;

      const action = {
        quizId: String(quiz.id || quiz._id || ""),
        title: String(quiz.title || ""),
        pathId: String(quiz.pathId || ""),
        subjectId: String(quiz.subjectId || ""),
        totalReferenced: integrity.totalReferenced,
        resolved: integrity.resolved,
        missingIds: integrity.missingIds,
        invalidContentIds: integrity.invalidContentIds,
      };
      actions.push(action);

      if (!dryRun) {
        await QuizModel.updateOne(
          { _id: quiz._id },
          {
            $set: {
              isPublished: false,
              approvalStatus: "pending_review",
              reviewerNotes: [
                String(quiz.reviewerNotes || "").trim(),
                "Auto-unpublished by integrity-repair: missing/invalid question references.",
              ]
                .filter(Boolean)
                .join(" | "),
            },
          },
        );
        unpublished += 1;
      }
    }

    clearPublicQuizListCache();
    clearPublicQuestionSummaryCache();

    res.json({
      dryRun,
      scanned,
      affected,
      unpublished,
      actions,
    });
  }),
);

quizRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const deleted = await QuizModel.findOneAndDelete(buildOwnedDocumentQuery(req.params.id, req.authUser!));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
    }

    const deletedIds = [deleted.id, deleted._id, req.params.id].map((value) => String(value || "")).filter(Boolean);
    await TopicModel.updateMany({ quizIds: { $in: deletedIds } }, { $pull: { quizIds: { $in: deletedIds } } });

    return res.json({ success: true });
  }),
);

quizRouter.post(
  "/results",
  requireAuth,
  asyncHandler(async (req, res) => {
    await recordAdminAuditLog(req, {
      action: "quiz.direct_result.blocked",
      resourceType: "quiz-result",
      status: "blocked",
      metadata: { bodyKeys: Object.keys(req.body || {}) },
    });

    return res.status(StatusCodes.GONE).json({
      message: DIRECT_RESULT_DISABLED_MESSAGE,
    });
  }),
);
