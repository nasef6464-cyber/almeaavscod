import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { eq, and, or, ne, desc, isNull, inArray, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/connection.js";
import { questions as pgQuestions, quizzes as pgQuizzes, quizResults as pgQuizResults, skillProgress as pgSkillProgress, skills as pgSkills, users as pgUsers, questionAttempts as pgQuestionAttempts } from "../db/schema/index.js";
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
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getActivePathIds, isStaffRole, withLearnerVisiblePaths } from "../services/visibility.js";
import { USE_PG } from "../utils/usePg.js";



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

const quizSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  pathId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  type: z.enum(["quiz", "bank"]).default("quiz"),
  mode: z.enum(["regular", "saher", "central"]).default("regular"),
  settings: z.record(z.any()),
  access: z.record(z.any()),
  questionIds: z.array(z.string()).default([]),
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

const questionAttemptSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIndex: z.number().default(-1),
  isCorrect: z.boolean().default(false),
  timeSpentSeconds: z.number().default(0),
  date: z.string().optional(),
});

const quizSubmitSchema = z.object({
  answers: z.record(z.coerce.number()).default({}),
  timeSpentSeconds: z.number().min(0).default(0),
});

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
  const ids = uniqueStrings(values.map((value) => String(value || "").trim()).filter(Boolean));
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

  if (USE_PG()) {
    const rows = await db.select({ skillIds: pgQuestions.skillIds }).from(pgQuestions)
      .where(inArray(pgQuestions.id, questionIds));
    return [...new Set(rows.flatMap((r) => r.skillIds || []).filter(Boolean))];
  }

  const questions = await QuestionModel.find({ id: { $in: questionIds } }).select("skillIds");
  return [...new Set(questions.flatMap((question) => question.skillIds || []).filter(Boolean))];
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

const canSubmitQuiz = async (quiz: any, user: any) => {
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

  const accessType = USE_PG() ? (quiz as any).accessType || "free" : quiz.access?.type || "free";

  if (accessType === "free") {
    return true;
  }

  const isPremium = USE_PG()
    ? (user as any).subscriptionPlan === "premium"
    : user.subscription?.plan === "premium";

  if (isPremium) {
    return true;
  }

  if (accessType === "private") {
    const allowedGroupIds = USE_PG()
      ? new Set((quiz.accessAllowedGroupIds || []).map(String))
      : new Set((quiz.access?.allowedGroupIds || []).map(String));
    const matchesAllowedGroup =
      allowedGroupIds.size === 0 || userGroupIds.some((groupId: string) => allowedGroupIds.has(groupId));
    return hasExplicitTarget || matchesAllowedGroup;
  }

  const subjectId = String(quiz.subjectId || "");
  const purchasedPackageIds = USE_PG()
    ? (user.purchasedPackages || []).map(String)
    : (user.subscription?.purchasedPackages || []).map(String);

  if (accessType === "course_only") {
    return (
      (await hasPurchasedPackageAccess(purchasedPackageIds, "courses", pathId, subjectId)) ||
      (await hasSchoolPackageAccess(user, "courses", pathId, subjectId))
    );
  }

  return (
    (await hasPurchasedPackageAccess(purchasedPackageIds, "tests", pathId, subjectId)) ||
    (await hasSchoolPackageAccess(user, "tests", pathId, subjectId))
  );
};

const updateSkillProgressFromResult = async (result: any, userId: string) => {
  const skillsAnalysis = Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : [];
  if (skillsAnalysis.length === 0) return;

  if (USE_PG()) {
    await Promise.all(
      skillsAnalysis
        .filter((skill: any) => skill?.skillId || skill?.skill)
        .map(async (skill: any) => {
          const skillId = String(skill.skillId || `${skill.subjectId || "subject"}:${skill.sectionId || "section"}:${skill.skill}`);
          const mastery = Math.max(0, Math.min(100, Number(skill.mastery || 0)));

          const existing = await db.select().from(pgSkillProgress)
            .where(and(eq(pgSkillProgress.userId, userId), eq(pgSkillProgress.skillId, skillId)))
            .limit(1);

          const previousAttempts = Number(existing[0]?.attempts || 0);
          const nextAttempts = previousAttempts + 1;
          const previousMastery = Number(existing[0]?.mastery || 0);
          const nextMastery = Math.round(((previousMastery * previousAttempts) + mastery) / nextAttempts);
          const nextStatus = buildSkillStatus(nextMastery);

          const values = {
            userId,
            skillId,
            skill: String(skill.skill || existing[0]?.skill || "مهارة غير مسماة"),
            pathId: String(skill.pathId || existing[0]?.pathId || ""),
            subjectId: String(skill.subjectId || existing[0]?.subjectId || ""),
            sectionId: String(skill.sectionId || existing[0]?.sectionId || ""),
            mastery: nextMastery,
            status: nextStatus,
            attempts: nextAttempts,
            lastQuizId: String(result.quizId || ""),
            lastQuizTitle: String(result.quizTitle || ""),
            lastAttemptAt: new Date(),
            recommendedAction: buildRecommendedAction(nextMastery, nextAttempts),
          };

          if (existing[0]) {
            await db.update(pgSkillProgress).set(values as any)
              .where(eq(pgSkillProgress.id, existing[0].id));
          } else {
            await db.insert(pgSkillProgress).values({
              id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              ...values,
            } as any);
          }
        }),
    );
    return;
  }

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

  const skills = await (USE_PG()
    ? db.select().from(pgSkills).where(inArray(pgSkills.id, skillIds))
    : SkillModel.find(buildDocumentsByIdsQuery(skillIds))
  );
  const mastery = attempt.isCorrect ? 100 : 0;

  if (USE_PG()) {
    await Promise.all(
      (skills as any[]).map(async (skill) => {
        const skillId = String(skill.id);
        const existing = await db.select().from(pgSkillProgress)
          .where(and(eq(pgSkillProgress.userId, userId), eq(pgSkillProgress.skillId, skillId)))
          .limit(1);
        const previousAttempts = Number(existing[0]?.attempts || 0);
        const nextAttempts = previousAttempts + 1;
        const previousMastery = Number(existing[0]?.mastery || 0);
        const nextMastery = Math.round(((previousMastery * previousAttempts) + mastery) / nextAttempts);
        const nextStatus = buildSkillStatus(nextMastery);

        const values = {
          userId,
          skillId,
          skill: String(skill.name || existing[0]?.skill || "مهارة غير مسماة"),
          pathId: String(skill.pathId || existing[0]?.pathId || attempt.pathId || ""),
          subjectId: String(skill.subjectId || existing[0]?.subjectId || attempt.subjectId || ""),
          sectionId: String(skill.sectionId || existing[0]?.sectionId || attempt.sectionId || ""),
          mastery: nextMastery,
          status: nextStatus,
          attempts: nextAttempts,
          lastQuizId: String(existing[0]?.lastQuizId || ""),
          lastQuizTitle: String(existing[0]?.lastQuizTitle || ""),
          lastAttemptAt: new Date(),
          recommendedAction: buildRecommendedAction(nextMastery, nextAttempts),
        };

        if (existing[0]) {
          await db.update(pgSkillProgress).set(values as any)
            .where(eq(pgSkillProgress.id, existing[0].id));
        } else {
          await db.insert(pgSkillProgress).values({
            id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            ...values,
          } as any);
        }
      }),
    );
    return;
  }

  await Promise.all(
    (skills as any[]).map(async (skill: any) => {
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

export const quizRouter = Router();

quizRouter.get(
  "/questions",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const staff = isStaffRole(req.authUser?.role);
      const conditions = staff ? [] : [
        or(eq(pgQuestions.approvalStatus, "approved"), isNull(pgQuestions.approvalStatus))
      ];
      const items = await db.select().from(pgQuestions)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(pgQuestions.createdAt));
      return res.json(items);
    }

    const baseFilter = isStaffRole(req.authUser?.role)
      ? {}
      : {
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
        };
    const filter = await withLearnerVisiblePaths(baseFilter, req.authUser);
    const items = await QuestionModel.find(filter).sort({ createdAt: -1 });
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

    if (USE_PG()) {
      const id = payload.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgQuestions).values({
        id,
        text: payload.text,
        options: payload.options,
        correctOptionIndex: payload.correctOptionIndex,
        explanation: payload.explanation || "",
        videoUrl: payload.videoUrl || "",
        imageUrl: payload.imageUrl || "",
        skillIds: payload.skillIds,
        pathId: payload.pathId,
        subject: payload.subject,
        sectionId: payload.sectionId || null,
        difficulty: payload.difficulty,
        type: payload.type,
        ...workflowDefaults,
        approvalStatus: req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

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

    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgQuestions).where(eq(pgQuestions.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Question not found" });
        }
      }
      const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);
      const [updated] = await db.update(pgQuestions)
        .set(sanitizedPayload as any)
        .where(eq(pgQuestions.id, req.params.id))
        .returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Question not found" });
      }
      return res.json(updated);
    }

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
    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgQuestions).where(eq(pgQuestions.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Question not found" });
        }
      }
      await db.delete(pgQuestions).where(eq(pgQuestions.id, req.params.id));
      return res.json({ success: true });
    }

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
    if (USE_PG()) {
      const staff = isStaffRole(req.authUser?.role);
      const conditions = staff ? [] : [
        eq(pgQuizzes.isPublished, true),
        ne(pgQuizzes.showOnPlatform, false),
        or(eq(pgQuizzes.approvalStatus, "approved"), isNull(pgQuizzes.approvalStatus))
      ];
      const items = await db.select().from(pgQuizzes)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(pgQuizzes.createdAt));
      return res.json(items);
    }

    const baseFilter = isStaffRole(req.authUser?.role)
      ? {}
      : {
          isPublished: true,
          showOnPlatform: { $ne: false },
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
        };
    const filter = await withLearnerVisiblePaths(baseFilter, req.authUser);
    const items = await QuizModel.find(filter).sort({ createdAt: -1 });
    res.json(items);
  }),
);

quizRouter.get(
  "/analytics/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authUser = await UserModel.findById(req.authUser!.id);

    if (!authUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    const managedPathIds = new Set((authUser.managedPathIds || []).map(String));
    const managedSubjectIds = new Set((authUser.managedSubjectIds || []).map(String));
    const allStudents = await UserModel.find({ role: "student" });
    let scopedStudents = allStudents.filter((student) => String(student.id) === req.authUser!.id);

    if (authUser.role === "admin") {
      scopedStudents = allStudents;
    } else if (authUser.role === "teacher" || authUser.role === "supervisor") {
      const allowedGroupIds = new Set((authUser.groupIds || []).map(String));
      scopedStudents = allStudents.filter((student) => {
        const studentGroupIds = (student.groupIds || []).map(String);
        const sharesGroup = studentGroupIds.some((groupId) => allowedGroupIds.has(groupId));
        const sharesSchool = !!authUser.schoolId && String(student.schoolId || "") === String(authUser.schoolId);
        return sharesGroup || sharesSchool;
      });
    } else if (authUser.role === "parent") {
      const linkedStudentIds = new Set((authUser.linkedStudentIds || []).map(String));
      scopedStudents = allStudents.filter((student) => linkedStudentIds.has(String(student.id)));
    }

    const scopedStudentIds = scopedStudents.map((student) => String(student.id));
    const relatedGroupIds = uniqueStrings([
      ...scopedStudents.flatMap((student) => (student.groupIds || []).map(String)),
      ...(authUser.groupIds || []).map(String),
      authUser.schoolId ? String(authUser.schoolId) : undefined,
    ]);

    const groups = relatedGroupIds.length
      ? await GroupModel.find(buildDocumentsByIdsQuery(relatedGroupIds))
      : [];

    const groupNameById = new Map(groups.map((group) => [String(group.id), String(group.name || "")]));

    let quizResults = scopedStudentIds.length
      ? await QuizResultModel.find({ userId: { $in: scopedStudentIds } }).sort({ createdAt: -1 })
      : [];

    if (authUser.role === "teacher" && (managedPathIds.size > 0 || managedSubjectIds.size > 0)) {
      quizResults = quizResults.filter((result) => {
        const skills = Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : [];
        return skills.some((gap: any) => matchesManagedScope(gap, managedPathIds, managedSubjectIds));
      });
    }

    let questionAttempts = scopedStudentIds.length
      ? await QuestionAttemptModel.find({ userId: { $in: scopedStudentIds } }).sort({ createdAt: -1 }).limit(5000)
      : [];

    if (authUser.role === "teacher" && (managedPathIds.size > 0 || managedSubjectIds.size > 0)) {
      questionAttempts = questionAttempts.filter((attempt) => matchesManagedScope(attempt, managedPathIds, managedSubjectIds));
    }

    const attemptSkillIds = uniqueStrings(questionAttempts.flatMap((attempt) => (attempt.skillIds || []).map(String)));
    const attemptSkills = attemptSkillIds.length ? await SkillModel.find(buildDocumentsByIdsQuery(attemptSkillIds)) : [];
    const skillById = new Map(attemptSkills.map((skill) => [String(skill.id || skill._id), skill]));
    const attemptSubjectIds = uniqueStrings([
      ...questionAttempts.map((attempt) => String(attempt.subjectId || "")),
      ...attemptSkills.map((skill) => String(skill.subjectId || "")),
    ]);
    const attemptSectionIds = uniqueStrings([
      ...questionAttempts.map((attempt) => String(attempt.sectionId || "")),
      ...attemptSkills.map((skill) => String(skill.sectionId || "")),
    ]);
    const attemptSubjects = attemptSubjectIds.length ? await SubjectModel.find(buildDocumentsByIdsQuery(attemptSubjectIds)) : [];
    const attemptSections = attemptSectionIds.length ? await SectionModel.find(buildDocumentsByIdsQuery(attemptSectionIds)) : [];
    const subjectNameById = new Map(attemptSubjects.map((subject) => [String(subject.id || subject._id), String(subject.name || "")]));
    const sectionNameById = new Map(attemptSections.map((section) => [String(section.id || section._id), String(section.name || "")]));
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
        const studentId = String(student.id);
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

        const weakestSkills = Array.from(weakSkillMap.values())
          .map((item) => ({
            skill: item.skill,
            mastery: Math.round(item.masterySum / Math.max(item.count, 1)),
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
          weakSkillCount: weakSkillMap.size,
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

    const weakestSkills = Array.from(weakSkillMap.values())
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
    }).sort({ createdAt: -1 }).limit(12);

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
        studentCount: scopedStudents.length,
        groupCount: relatedGroupIds.length,
        quizAttempts: quizResults.length,
        questionAttempts: questionAttempts.length,
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
    if (USE_PG()) {
      const items = await db.select().from(pgQuizResults)
        .where(eq(pgQuizResults.userId, req.authUser!.id))
        .orderBy(desc(pgQuizResults.createdAt));
      return res.json(items);
    }
    const items = await QuizResultModel.find({ userId: req.authUser!.id }).sort({ createdAt: -1 });
    res.json(items);
  }),
);

quizRouter.get(
  "/skill-progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const items = await db.select().from(pgSkillProgress)
        .where(eq(pgSkillProgress.userId, req.authUser!.id))
        .orderBy(pgSkillProgress.mastery, desc(pgSkillProgress.lastAttemptAt));
      return res.json(items);
    }
    const items = await SkillProgressModel.find({ userId: req.authUser!.id }).sort({ mastery: 1, lastAttemptAt: -1 });
    res.json(items);
  }),
);

quizRouter.get(
  "/question-attempts",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const items = await db.select().from(pgQuestionAttempts)
        .where(eq(pgQuestionAttempts.userId, req.authUser!.id))
        .orderBy(desc(pgQuestionAttempts.createdAt))
        .limit(500);
      return res.json(items);
    }
    const items = await QuestionAttemptModel.find({ userId: req.authUser!.id }).sort({ createdAt: -1 }).limit(500);
    res.json(items);
  }),
);

quizRouter.post(
  "/question-attempts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = questionAttemptSchema.parse(req.body);

    if (USE_PG()) {
      const question = await db.select().from(pgQuestions).where(eq(pgQuestions.id, payload.questionId)).limit(1);
      const q = question[0];
      const created = await db.insert(pgQuestionAttempts).values({
        id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...payload,
        userId: req.authUser!.id,
        date: payload.date || new Date().toISOString(),
        pathId: String(q?.pathId || ""),
        subjectId: String(q?.subject || ""),
        sectionId: String(q?.sectionId || ""),
        skillIds: Array.isArray(q?.skillIds) ? q.skillIds.map(String) : [],
      } as any).returning();
      await updateSkillProgressFromQuestionAttempt(created[0], req.authUser!.id);
      return res.status(StatusCodes.CREATED).json(created[0]);
    }

    const question = await QuestionModel.findOne(buildDocumentQuery(payload.questionId)).select("id pathId subject sectionId skillIds");
    const created = await QuestionAttemptModel.create({
      ...payload,
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
    if (USE_PG()) {
      const result = await db.select().from(pgQuizResults)
        .where(eq(pgQuizResults.userId, req.authUser!.id))
        .orderBy(desc(pgQuizResults.createdAt))
        .limit(1);
      const item = result[0];
      if (!item) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "No quiz results found" });
      }
      return res.json(item);
    }

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
    const payload = quizSchema.parse(req.body);
    await assertTeacherManagedScope(req.authUser!, payload);
    const resolvedSkillIds = await resolveQuizSkillIds(payload.questionIds);
    const workflowDefaults = getWorkflowDefaults(req.authUser!);

    if (USE_PG()) {
      const id = payload.id || `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgQuizzes).values({
        id,
        title: payload.title,
        description: payload.description || "",
        pathId: payload.pathId,
        subjectId: payload.subjectId,
        sectionId: payload.sectionId || null,
        type: payload.type || "quiz",
        mode: payload.mode || "regular",
        settings: payload.settings || {},
        questionIds: payload.questionIds || [],
        skillIds: resolvedSkillIds,
        targetGroupIds: payload.targetGroupIds || [],
        targetUserIds: payload.targetUserIds || [],
        dueDate: payload.dueDate || null,
        isPublished: req.authUser?.role === "admin" ? payload.isPublished : false,
        showOnPlatform: typeof payload.showOnPlatform === "boolean" ? payload.showOnPlatform : false,
        ...workflowDefaults,
        approvalStatus: req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
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

    if (USE_PG()) {
      const quizResult = await db.select().from(pgQuizzes).where(eq(pgQuizzes.id, req.params.id)).limit(1);
      const quiz = quizResult[0];
      if (!quiz) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
      }

      const userResult = await db.select().from(pgUsers).where(eq(pgUsers.id, req.authUser!.id)).limit(1);
      const authUser = userResult[0];
      if (!authUser) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
      }

      if (!(await canSubmitQuiz(quiz, authUser))) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot submit this quiz" });
      }

      const questionIds = Array.isArray(quiz.questionIds) ? quiz.questionIds.map(String).filter(Boolean) : [];
      const questions = questionIds.length
        ? await db.select().from(pgQuestions).where(inArray(pgQuestions.id, questionIds))
        : [];

      if (questions.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "Quiz has no valid questions" });
      }

      const allSkillIds = uniqueStrings(questions.flatMap((q: any) => (q.skillIds || []).map(String)));
      const skills = allSkillIds.length
        ? await db.select().from(pgSkills).where(inArray(pgSkills.id, allSkillIds))
        : [];
      const skillById = new Map(skills.map((s: any) => [String(s.id), s]));

      let correctAnswers = 0, wrongAnswers = 0, unanswered = 0;
      const skillStats = new Map<string, { total: number; correct: number }>();

      const questionReview = questions.map((question: any) => {
        const questionId = String(question.id);
        const rawSelected = payload.answers[questionId];
        const selectedOptionIndex = typeof rawSelected === "number" && rawSelected >= 0 ? rawSelected : undefined;
        const isCorrect = selectedOptionIndex === Number(question.correctOptionIndex ?? 0);

        if (selectedOptionIndex === undefined) { unanswered += 1; }
        else if (isCorrect) { correctAnswers += 1; }
        else { wrongAnswers += 1; }

        (question.skillIds || []).map(String).filter(Boolean).forEach((skillId: string) => {
          const current = skillStats.get(skillId) || { total: 0, correct: 0 };
          current.total += 1;
          if (isCorrect) current.correct += 1;
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
        return {
          skillId,
          pathId: String(skill?.pathId || quiz.pathId || ""),
          subjectId: String(skill?.subjectId || quiz.subjectId || ""),
          sectionId: String(skill?.sectionId || quiz.sectionId || ""),
          skill: String(skill?.name || "مهارة غير مسماة"),
          mastery,
          status,
          recommendation: buildSkillRecommendation(mastery),
          section: "",
        };
      });

      const totalQuestions = questions.length;
      const score = Math.round((correctAnswers / Math.max(totalQuestions, 1)) * 100);
      const timeSpentMinutes = Math.max(0, Math.round(payload.timeSpentSeconds / 60));

      const [result] = await db.insert(pgQuizResults).values({
        id: `qr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId: req.authUser!.id,
        quizId: quiz.id,
        quizTitle: String(quiz.title || "اختبار"),
        score,
        totalQuestions,
        correctAnswers,
        wrongAnswers,
        unanswered,
        timeSpent: timeSpentMinutes > 0 ? `${timeSpentMinutes} دقيقة` : "أقل من دقيقة",
        date: new Date().toISOString(),
        skillsAnalysis: skillsAnalysis,
        questionReview: questionReview,
      } as any).returning();

      await updateSkillProgressFromResult(result, req.authUser!.id);
      return res.status(StatusCodes.CREATED).json(result);
    }

    const quiz = await QuizModel.findOne(buildDocumentQuery(req.params.id));

    if (!quiz) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
    }

    const authUser = await UserModel.findById(req.authUser!.id);
    if (!authUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    if (!(await canSubmitQuiz(quiz, authUser))) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot submit this quiz" });
    }

    const questionIds = Array.isArray(quiz.questionIds) ? quiz.questionIds.map(String).filter(Boolean) : [];
    const questions = questionIds.length ? await QuestionModel.find(buildDocumentsByIdsQuery(questionIds)) : [];
    const questionById = new Map<string, any>();
    questions.forEach((question) => {
      questionById.set(String(question.id || question._id), question);
    });

    const orderedQuestions = questionIds
      .map((questionId) => questionById.get(questionId))
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
    const timeSpentMinutes = Math.max(0, Math.round(payload.timeSpentSeconds / 60));
    const result = await QuizResultModel.create({
      userId: req.authUser!.id,
      quizId: String(quiz.id || quiz._id),
      quizTitle: String(quiz.title || "اختبار"),
      score,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      unanswered,
      timeSpent: timeSpentMinutes > 0 ? `${timeSpentMinutes} دقيقة` : "أقل من دقيقة",
      date: new Date().toISOString(),
      skillsAnalysis,
      questionReview,
    });

    await updateSkillProgressFromResult(result, req.authUser!.id);
    return res.status(StatusCodes.CREATED).json(result);
  }),
);

quizRouter.patch(
  "/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = quizSchema.partial().parse(req.body);

    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgQuizzes).where(eq(pgQuizzes.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
        }
      }
      const resolvedSkillIds = payload.questionIds
        ? await resolveQuizSkillIds(payload.questionIds)
        : undefined;
      const sanitizedPayload = sanitizeWorkflowUpdate(
        {
          ...payload,
          ...(resolvedSkillIds ? { skillIds: resolvedSkillIds } : {}),
        } as Record<string, unknown>,
        req.authUser!,
        { respectPublished: true },
      );
      const [updated] = await db.update(pgQuizzes)
        .set(sanitizedPayload as any)
        .where(eq(pgQuizzes.id, req.params.id))
        .returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
      }
      return res.json(updated);
    }

    const documentQuery = buildOwnedDocumentQuery(req.params.id, req.authUser!);
    const existing = await QuizModel.findOne(documentQuery);

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
    }

    await assertTeacherManagedScope(req.authUser!, {
      ...existing.toObject(),
      ...payload,
    });
    const resolvedSkillIds = payload.questionIds
      ? await resolveQuizSkillIds(payload.questionIds)
      : undefined;
    const sanitizedPayload = sanitizeWorkflowUpdate(
      {
        ...payload,
        ...(resolvedSkillIds ? { skillIds: resolvedSkillIds } : {}),
      } as Record<string, unknown>,
      req.authUser!,
      { respectPublished: true },
    );
    const updated = await QuizModel.findOneAndUpdate(documentQuery, sanitizedPayload, { new: true });
    return res.json(updated);
  }),
);

quizRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgQuizzes).where(eq(pgQuizzes.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
        }
      }
      await db.delete(pgQuizzes).where(eq(pgQuizzes.id, req.params.id));
      return res.json({ success: true });
    }

    const deleted = await QuizModel.findOneAndDelete(buildOwnedDocumentQuery(req.params.id, req.authUser!));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Quiz not found" });
    }

    return res.json({ success: true });
  }),
);

quizRouter.post(
  "/results",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const [created] = await db.insert(pgQuizResults).values({
        id: `qr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...req.body,
        userId: req.authUser!.id,
      } as any).returning();
      await updateSkillProgressFromResult(created, req.authUser!.id);
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await QuizResultModel.create({
      ...req.body,
      userId: req.authUser!.id,
    });
    await updateSkillProgressFromResult(created, req.authUser!.id);
    res.status(StatusCodes.CREATED).json(created);
  }),
);

quizRouter.get(
  "/results/scoped",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const userId = req.authUser!.id;

    if (USE_PG()) {
      const [data, totalResult] = await Promise.all([
        db.select().from(pgQuizResults)
          .where(eq(pgQuizResults.userId, userId))
          .orderBy(desc(pgQuizResults.createdAt))
          .limit(Number(limit)).offset(skip),
        db.select({ count: count() }).from(pgQuizResults).where(eq(pgQuizResults.userId, userId)),
      ]);
      return res.json({ data, total: Number(totalResult[0]?.count || 0) });
    }

    const data = await QuizResultModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await QuizResultModel.countDocuments({ userId });
    return res.json({ data, total });
  }),
);
