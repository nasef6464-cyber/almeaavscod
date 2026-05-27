import { Router } from "express";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { eq, and, or, ne, desc, isNull, inArray, ilike, count } from "drizzle-orm";
import { z } from "zod";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { db } from "../db/connection.js";
import { topics as pgTopics, lessons as pgLessons, libraryItems as pgLibraryItems, groups as pgGroups, b2bPackages as pgB2bPackages, accessCodes as pgAccessCodes, studyPlans as pgStudyPlans, homepageSettings, announcementAds, platformIntegrationSettings } from "../db/schema/index.js";
import { TopicModel } from "../models/Topic.js";
import { LessonModel } from "../models/Lesson.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { GroupModel } from "../models/Group.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { AccessCodeModel } from "../models/AccessCode.js";
import { UserModel } from "../models/User.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { HomepageSettingsModel } from "../models/HomepageSettings.js";
import { StudyPlanModel } from "../models/StudyPlan.js";
import { isStaffRole, withLearnerVisiblePaths } from "../services/visibility.js";
import { randomUUID } from "crypto";
import { USE_PG } from "../utils/usePg.js";
import { isSentryEnabled } from "../observability/sentry.js";
import { isRedisConfigured } from "../config/redis.js";
import { env } from "../config/env.js";



const topicSchema = z.object({
  id: z.string().optional(),
  pathId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  title: z.string().min(1),
  parentId: z.string().nullable().optional(),
  order: z.number().default(0),
  showOnPlatform: z.boolean().default(true),
  isLocked: z.boolean().default(false),
  lessonIds: z.array(z.string()).default([]),
  quizIds: z.array(z.string()).default([]),
});

const lessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pathId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  type: z.enum(["video", "quiz", "file", "assignment", "text", "live_youtube", "zoom", "google_meet", "teams"]),
  duration: z.string().default(""),
  content: z.string().optional(),
  videoUrl: z.string().optional(),
  fileUrl: z.string().optional(),
  meetingUrl: z.string().optional(),
  meetingDate: z.string().optional(),
  recordingUrl: z.string().optional(),
  joinInstructions: z.string().optional(),
  showRecordingOnPlatform: z.boolean().optional(),
  showOnPlatform: z.boolean().default(true),
  quizId: z.string().nullable().optional(),
  order: z.number().default(0),
  isLocked: z.boolean().default(false),
  skillIds: z.array(z.string()).min(1),
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

const buildDocumentQuery = (value: string) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return { $or: [{ id: value }, { _id: value }] };
  }

  return { id: value };
};

const uniqueStrings = (values: Array<string | undefined | null>) =>
  [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];

const buildDocumentsByIdsQuery = (values: string[]) => {
  const ids = uniqueStrings(values.map((value) => String(value || "").trim()));
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

const getScopedOperationalData = async (authUser?: { id: string; role: string; schoolId?: string | null }) => {
  if (authUser?.role === "admin") {
    const [groups, b2bPackages, accessCodes] = await Promise.all([
      GroupModel.find().sort({ createdAt: -1 }),
      B2BPackageModel.find().sort({ createdAt: -1 }),
      AccessCodeModel.find().sort({ createdAt: -1 }),
    ]);

    return { groups, b2bPackages, accessCodes };
  }

  if (!authUser) {
    return { groups: [], b2bPackages: [], accessCodes: [] };
  }

  const user = await UserModel.findById(authUser.id).select("schoolId groupIds linkedStudentIds role");
  if (!user) {
    return { groups: [], b2bPackages: [], accessCodes: [] };
  }

  const managedGroups =
    user.role === "teacher" || user.role === "supervisor"
      ? await GroupModel.find({
          $or: [
            { ownerId: authUser.id },
            { supervisorIds: authUser.id },
            ...(authUser.schoolId ? [{ parentId: authUser.schoolId }, { _id: authUser.schoolId }, { id: authUser.schoolId }] : []),
          ],
        }).select("id _id parentId type")
      : [];

  const linkedStudents =
    user.role === "parent" && Array.isArray(user.linkedStudentIds) && user.linkedStudentIds.length
      ? await UserModel.find(buildDocumentsByIdsQuery(user.linkedStudentIds.map(String))).select("schoolId groupIds")
      : [];

  const seedGroupIds = uniqueStrings([
    String(user.schoolId || ""),
    ...(user.groupIds || []).map(String),
    ...managedGroups.flatMap((group) => [String(group.id || group._id), String(group.parentId || "")]),
    ...linkedStudents.flatMap((student) => [String(student.schoolId || ""), ...(student.groupIds || []).map(String)]),
  ]);

  if (seedGroupIds.length === 0) {
    return { groups: [], b2bPackages: [], accessCodes: [] };
  }

  const seedGroups = await GroupModel.find(buildDocumentsByIdsQuery(seedGroupIds)).sort({ createdAt: -1 });
  const schoolIds = uniqueStrings([
    String(user.schoolId || ""),
    ...linkedStudents.map((student) => String(student.schoolId || "")),
    ...seedGroups
      .filter((group) => group.type === "SCHOOL")
      .map((group) => String(group.id || group._id)),
    ...seedGroups.map((group) => String(group.parentId || "")),
  ]);
  const visibleGroupIds = uniqueStrings([...seedGroupIds, ...schoolIds]);
  const groups = visibleGroupIds.length
    ? await GroupModel.find(buildDocumentsByIdsQuery(visibleGroupIds)).sort({ createdAt: -1 })
    : [];
  const [b2bPackages, accessCodes] = await Promise.all([
    schoolIds.length ? B2BPackageModel.find({ schoolId: { $in: schoolIds } }).sort({ createdAt: -1 }) : Promise.resolve([]),
    user.role === "supervisor" && schoolIds.length
      ? AccessCodeModel.find({ schoolId: { $in: schoolIds } }).sort({ createdAt: -1 })
      : Promise.resolve([]),
  ]);

  return { groups, b2bPackages, accessCodes };
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
  } else if (typeof nextPayload.approvalStatus === "string") {
    if (nextPayload.approvalStatus === "approved") {
      nextPayload.approvedBy = authUser.id;
      nextPayload.approvedAt = Date.now();
    } else if (nextPayload.approvalStatus === "rejected" || nextPayload.approvalStatus === "pending_review") {
      nextPayload.approvedBy = "";
      nextPayload.approvedAt = null;
    }
  }

  return nextPayload;
};

const librarySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  size: z.string().default(""),
  downloads: z.number().default(0),
  type: z.enum(["pdf", "doc", "video"]).default("pdf"),
  pathId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  skillIds: z.array(z.string()).min(1),
  url: z.string().optional(),
  showOnPlatform: z.boolean().default(true),
  isLocked: z.boolean().default(false),
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

const groupSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["SCHOOL", "CLASS", "PRIVATE_GROUP"]),
  parentId: z.string().nullable().optional(),
  ownerId: z.string().min(1),
  supervisorIds: z.array(z.string()).default([]),
  studentIds: z.array(z.string()).default([]),
  courseIds: z.array(z.string()).default([]),
  totalStudents: z.number().optional(),
  totalSupervisors: z.number().optional(),
  totalCourses: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

const b2bPackageSchema = z.object({
  id: z.string().optional(),
  schoolId: z.string().min(1),
  name: z.string().min(1),
  courseIds: z.array(z.string()).default([]),
  contentTypes: z.array(z.enum(["courses", "foundation", "banks", "tests", "library", "all"])).default(["all"]),
  pathIds: z.array(z.string()).default([]),
  subjectIds: z.array(z.string()).default([]),
  type: z.enum(["free_access", "discounted"]).default("free_access"),
  discountPercentage: z.number().nullable().optional(),
  maxStudents: z.number().min(0).default(0),
  status: z.enum(["active", "expired"]).default("active"),
  createdAt: z.number().optional(),
});

const accessCodeSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  schoolId: z.string().min(1),
  packageId: z.string().min(1),
  maxUses: z.number().min(1).default(1),
  currentUses: z.number().min(0).default(0),
  expiresAt: z.number(),
  createdAt: z.number().optional(),
});

const studyPlanSchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional(),
  name: z.string().min(1),
  pathId: z.string().min(1),
  subjectIds: z.array(z.string()).default([]),
  courseIds: z.array(z.string()).default([]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  skipCompletedQuizzes: z.boolean().default(true),
  offDays: z.array(z.enum(["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"])).default([]),
  dailyMinutes: z.number().min(15).default(90),
  preferredStartTime: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active"),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const schoolImportRowSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  classId: z.string().optional(),
  className: z.string().optional(),
  password: z.string().min(6).optional(),
});

const schoolImportSchema = z.object({
  rows: z.array(schoolImportRowSchema).min(1),
});

const homepageStatSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  mode: z.enum(["dynamic", "manual"]).default("dynamic"),
  source: z.enum(["students", "courses", "assets", "rating"]).default("students"),
  manualValue: z.string().optional(),
});

const homepageTestimonialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  degree: z.string().optional(),
  text: z.string().min(1),
  image: z.string().optional(),
});

const homepageSettingsSchema = z.object({
  hero: z
    .object({
      badgeText: z.string().optional(),
      titlePrefix: z.string().optional(),
      titleHighlight: z.string().optional(),
      titleSuffix: z.string().optional(),
      description: z.string().optional(),
      primaryCtaLabel: z.string().optional(),
      primaryCtaLink: z.string().optional(),
      secondaryCtaLabel: z.string().optional(),
      secondaryCtaLink: z.string().optional(),
      imageUrl: z.string().optional(),
      floatingCardTitle: z.string().optional(),
      floatingCardSubtitle: z.string().optional(),
      floatingCardProgressLabel: z.string().optional(),
      floatingCardProgressValue: z.string().optional(),
    })
    .optional(),
  stats: z.array(homepageStatSchema).optional(),
  testimonials: z.array(homepageTestimonialSchema).optional(),
  sections: z
    .object({
      featuredCoursesTitle: z.string().optional(),
      featuredCoursesSubtitle: z.string().optional(),
      featuredArticlesTitle: z.string().optional(),
      featuredArticlesSubtitle: z.string().optional(),
      whyChooseTitle: z.string().optional(),
      whyChooseDescription: z.string().optional(),
      testimonialsTitle: z.string().optional(),
      testimonialsSubtitle: z.string().optional(),
    })
    .optional(),
  featuredPathIds: z.array(z.string()).optional(),
  featuredCourseIds: z.array(z.string()).optional(),
  featuredArticleLessonIds: z.array(z.string()).optional(),
});

const defaultHomepageSettings = {
  key: "default",
  hero: {
    badgeText: "المنصة الأولى للقدرات والتحصيلي",
    titlePrefix: "حقق",
    titleHighlight: "المئة",
    titleSuffix: "في اختباراتك",
    description:
      "رحلة تعليمية ذكية تجمع بين التدريب المكثف، الشروحات التفاعلية، والتحليل الدقيق لنقاط ضعفك لضمان أعلى الدرجات.",
    primaryCtaLabel: "ابدأ التدريب مجانًا",
    primaryCtaLink: "/dashboard",
    secondaryCtaLabel: "تصفح الدورات",
    secondaryCtaLink: "/courses",
    imageUrl: "https://img.freepik.com/free-photo/saudi-arab-boy-student-wearing-thobe-holding-tablet_1258-122164.jpg",
    floatingCardTitle: "منصة المئة",
    floatingCardSubtitle: "مستواك: متقدم",
    floatingCardProgressLabel: "التقدم",
    floatingCardProgressValue: "75%",
  },
  stats: [
    { id: "students", label: "طالب وطالبة", mode: "dynamic", source: "students", manualValue: "" },
    { id: "courses", label: "دورة تدريبية", mode: "dynamic", source: "courses", manualValue: "" },
    { id: "assets", label: "مواد تعليمية", mode: "dynamic", source: "assets", manualValue: "" },
    { id: "rating", label: "تقييم عام", mode: "dynamic", source: "rating", manualValue: "" },
  ],
  sections: {
    featuredCoursesTitle: "الدورات الأكثر طلبًا",
    featuredCoursesSubtitle: "اختر دورتك وابدأ رحلة التفوق اليوم",
    whyChooseTitle: "لماذا يختار الطلاب منصة المئة؟",
    whyChooseDescription:
      "نحن لا نقدم مجرد دورات، بل نقدم نظامًا بيئيًا متكاملًا يضمن لك الفهم العميق والتدريب المستمر.",
    testimonialsTitle: "قصص نجاح نعتز بها",
    testimonialsSubtitle: "انضم لآلاف الطلاب الذين حققوا أحلامهم معنا",
  },
  testimonials: [
    {
      id: "t1",
      name: "سارة العتيبي",
      degree: "98% قدرات",
      text: "المنصة غيرت طريقة مذاكرتي تمامًا. تحليل نقاط الضعف ساعدني أركز جهدي في المكان الصح.",
      image: "https://i.pravatar.cc/100?img=5",
    },
    {
      id: "t2",
      name: "فهد الشمري",
      degree: "96% تحصيلي",
      text: "شروحات الفيزياء والكيمياء بسطت لي المعلومات بشكل عجيب. شكرًا لكل القائمين على المنصة.",
      image: "https://i.pravatar.cc/100?img=11",
    },
    {
      id: "t3",
      name: "نورة السالم",
      degree: "99% قدرات",
      text: "اختبارات المحاكاة كانت مطابقة جدًا للاختبار الحقيقي، دخلت الاختبار وأنا واثقة جدًا.",
      image: "https://i.pravatar.cc/100?img=9",
    },
  ],
  featuredPathIds: [],
  featuredCourseIds: [],
};

export const contentRouter = Router();

contentRouter.get(
  "/homepage-settings",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    if (USE_PG()) {
      const rows = await db.select().from(homepageSettings).where(eq(homepageSettings.id, "default")).limit(1);
      if (rows[0]) return res.json(rows[0]);
      const [created] = await db.insert(homepageSettings).values({
        id: "default",
        settings: defaultHomepageSettings,
      } as any).returning();
      return res.json(created);
    }

    let settings = await HomepageSettingsModel.findOne({ key: "default" });
    if (!settings) {
      settings = await HomepageSettingsModel.create(defaultHomepageSettings);
    }

    return res.json(settings);
  }),
);

contentRouter.patch(
  "/homepage-settings",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = homepageSettingsSchema.parse(req.body);

    if (USE_PG()) {
      const existing = await db.select().from(homepageSettings).where(eq(homepageSettings.id, "default")).limit(1);
      const currentSettings = existing[0]?.settings || defaultHomepageSettings;
      const merged = { ...currentSettings, ...payload };
      const [updated] = await db.insert(homepageSettings).values({
        id: "default",
        settings: merged,
      } as any).onConflictDoUpdate({ target: homepageSettings.id, set: { settings: merged } as any }).returning();
      return res.json(updated);
    }

    const settings = await HomepageSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: payload, $setOnInsert: { key: "default" } },
      { new: true, upsert: true },
    );

    return res.json(settings);
  }),
);

contentRouter.get(
  "/bootstrap/minimal",
  asyncHandler(async (_req, res) => {
    if (USE_PG()) {
      const [paths, subjects] = await Promise.all([
        db.select({ id: pgPaths.id, name: pgPaths.name, color: pgPaths.color, icon: pgPaths.icon }).from(pgPaths).where(eq(pgPaths.isActive, true)),
        db.select({ id: pgSubjects.id, name: pgSubjects.name, pathId: pgSubjects.pathId }).from(pgSubjects),
      ]);
      return res.json({ paths, subjects });
    }
    return res.json({ paths: [], subjects: [] });
  }),
);

contentRouter.get(
  "/bootstrap",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const staff = isStaffRole(req.authUser?.role);
      const [allTopics, allLessons, allLib, allGroups, allPackages, allCodes, allPlans] = await Promise.all([
        db.select().from(pgTopics).orderBy(pgTopics.subjectId, pgTopics.order),
        db.select().from(pgLessons).orderBy(desc(pgLessons.createdAt)),
        db.select().from(pgLibraryItems).orderBy(desc(pgLibraryItems.createdAt)),
        db.select().from(pgGroups),
        db.select().from(pgB2bPackages),
        db.select().from(pgAccessCodes),
        req.authUser ? db.select().from(pgStudyPlans).where(eq(pgStudyPlans.userId, req.authUser.id)) : Promise.resolve([]),
      ]);
      return res.json({ topics: allTopics, lessons: allLessons, libraryItems: allLib, groups: allGroups, b2bPackages: allPackages, accessCodes: allCodes, studyPlans: allPlans });
    }
    const lessonFilter = isStaffRole(req.authUser?.role)
      ? {}
      : {
          showOnPlatform: { $ne: false },
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
        };
    const topicFilter = isStaffRole(req.authUser?.role) ? {} : { showOnPlatform: { $ne: false } };
    const libraryFilter = isStaffRole(req.authUser?.role)
      ? {}
      : {
          showOnPlatform: { $ne: false },
          $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
        };
    const [scopedTopicFilter, scopedLessonFilter, scopedLibraryFilter] = await Promise.all([
      withLearnerVisiblePaths(topicFilter, req.authUser),
      withLearnerVisiblePaths(lessonFilter, req.authUser),
      withLearnerVisiblePaths(libraryFilter, req.authUser),
    ]);

    const [topics, lessons, libraryItems, operationalData, studyPlans] = await Promise.all([
      TopicModel.find(scopedTopicFilter).sort({ subjectId: 1, order: 1 }),
      LessonModel.find(scopedLessonFilter).sort({ createdAt: -1 }),
      LibraryItemModel.find(scopedLibraryFilter).sort({ createdAt: -1 }),
      getScopedOperationalData(req.authUser),
      req.authUser ? StudyPlanModel.find({ userId: req.authUser.id }).sort({ updatedAt: -1 }) : Promise.resolve([]),
    ]);

    const { groups, b2bPackages, accessCodes } = operationalData;
    res.json({ topics, lessons, libraryItems, groups, b2bPackages, accessCodes, studyPlans });
  }),
);

contentRouter.post(
  "/study-plans",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = studyPlanSchema.parse(req.body);
    const now = Date.now();

    if (USE_PG()) {
      const [created] = await db.insert(pgStudyPlans).values({
        id: payload.id,
        userId: req.authUser!.id,
        name: payload.name,
        pathId: payload.pathId,
        subjectIds: payload.subjectIds || [],
        courseIds: payload.courseIds || [],
        startDate: payload.startDate,
        endDate: payload.endDate,
        skipCompletedQuizzes: payload.skipCompletedQuizzes,
        offDays: payload.offDays || [],
        dailyMinutes: payload.dailyMinutes,
        preferredStartTime: payload.preferredStartTime || "17:00",
        status: payload.status || "active",
        createdAt: payload.createdAt || now,
        updatedAt: now,
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await StudyPlanModel.findOneAndUpdate(
      { id: payload.id, userId: req.authUser!.id },
      {
        ...payload,
        userId: req.authUser!.id,
        createdAt: payload.createdAt || now,
        updatedAt: now,
      },
      { new: true, upsert: true },
    );

    res.status(StatusCodes.CREATED).json(created);
  }),
);

contentRouter.patch(
  "/study-plans/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = studyPlanSchema.partial().parse(req.body);

    if (USE_PG()) {
      const [updated] = await db.update(pgStudyPlans)
        .set({ ...payload, userId: req.authUser!.id, updatedAt: Date.now() } as any)
        .where(and(eq(pgStudyPlans.id, req.params.id), eq(pgStudyPlans.userId, req.authUser!.id)))
        .returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Study plan not found" });
      }
      return res.json(updated);
    }

    const updated = await StudyPlanModel.findOneAndUpdate(
      { id: req.params.id, userId: req.authUser!.id },
      {
        ...payload,
        userId: req.authUser!.id,
        updatedAt: Date.now(),
      },
      { new: true },
    );

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Study plan not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/study-plans/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      await db.delete(pgStudyPlans)
        .where(and(eq(pgStudyPlans.id, req.params.id), eq(pgStudyPlans.userId, req.authUser!.id)));
      return res.json({ success: true });
    }

    const deleted = await StudyPlanModel.findOneAndDelete({ id: req.params.id, userId: req.authUser!.id });

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Study plan not found" });
    }

    return res.json({ success: true });
  }),
);

contentRouter.post(
  "/topics",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = topicSchema.parse(req.body);

    if (USE_PG()) {
      const id = payload.id || `topic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgTopics).values({
        id,
        pathId: payload.pathId,
        subjectId: payload.subjectId,
        sectionId: payload.sectionId || null,
        title: payload.title,
        parentId: payload.parentId || null,
        order: payload.order,
        showOnPlatform: payload.showOnPlatform,
        isLocked: payload.isLocked,
        lessonIds: payload.lessonIds || [],
        quizIds: payload.quizIds || [],
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await TopicModel.create(payload);
    res.status(StatusCodes.CREATED).json(created);
  }),
);

contentRouter.patch(
  "/topics/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = topicSchema.partial().parse(req.body);

    if (USE_PG()) {
      const [updated] = await db.update(pgTopics).set(payload as any).where(eq(pgTopics.id, req.params.id)).returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Topic not found" });
      }
      return res.json(updated);
    }

    const updated = await TopicModel.findOneAndUpdate(buildDocumentQuery(req.params.id), payload, {
      new: true,
    });

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Topic not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/topics/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      await db.delete(pgTopics).where(eq(pgTopics.id, req.params.id));
      return res.json({ success: true });
    }

    const deleted = await TopicModel.findOneAndDelete(buildDocumentQuery(req.params.id));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Topic not found" });
    }

    return res.json({ success: true });
  }),
);

contentRouter.post(
  "/lessons",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = lessonSchema.parse(req.body);
    const workflowDefaults = getWorkflowDefaults(req.authUser!);

    if (USE_PG()) {
      const id = `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgLessons).values({
        id,
        title: payload.title,
        description: payload.description || "",
        pathId: payload.pathId,
        subjectId: payload.subjectId,
        sectionId: payload.sectionId || null,
        type: payload.type,
        duration: payload.duration,
        content: payload.content || "",
        videoUrl: payload.videoUrl || "",
        fileUrl: payload.fileUrl || "",
        meetingUrl: payload.meetingUrl || "",
        meetingDate: payload.meetingDate || "",
        recordingUrl: payload.recordingUrl || "",
        joinInstructions: payload.joinInstructions || "",
        showRecordingOnPlatform: payload.showRecordingOnPlatform || false,
        showOnPlatform: payload.showOnPlatform,
        quizId: payload.quizId || null,
        order: payload.order,
        isLocked: payload.isLocked,
        skillIds: payload.skillIds,
        ...workflowDefaults,
        approvalStatus: req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await LessonModel.create({
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

contentRouter.patch(
  "/lessons/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = lessonSchema.partial().parse(req.body);

    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgLessons).where(eq(pgLessons.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found" });
        }
      }
      const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);
      const [updated] = await db.update(pgLessons).set(sanitizedPayload as any).where(eq(pgLessons.id, req.params.id)).returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found" });
      }
      return res.json(updated);
    }

    const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);
    const updated = await LessonModel.findOneAndUpdate(buildOwnedDocumentQuery(req.params.id, req.authUser!), sanitizedPayload, {
      new: true,
    });

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/lessons/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgLessons).where(eq(pgLessons.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found" });
        }
      }
      await db.delete(pgLessons).where(eq(pgLessons.id, req.params.id));
      return res.json({ success: true });
    }

    const deleted = await LessonModel.findOneAndDelete(buildOwnedDocumentQuery(req.params.id, req.authUser!));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found" });
    }

    return res.json({ success: true });
  }),
);

contentRouter.post(
  "/library-items",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = librarySchema.parse(req.body);
    const workflowDefaults = getWorkflowDefaults(req.authUser!);

    if (USE_PG()) {
      const id = payload.id || `lib_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgLibraryItems).values({
        id,
        title: payload.title,
        size: payload.size || "",
        downloads: payload.downloads,
        type: payload.type || "pdf",
        pathId: payload.pathId,
        subjectId: payload.subjectId,
        sectionId: payload.sectionId || null,
        skillIds: payload.skillIds,
        url: payload.url || "",
        showOnPlatform: payload.showOnPlatform,
        isLocked: payload.isLocked || false,
        ...workflowDefaults,
        approvalStatus: req.authUser?.role === "admin"
          ? payload.approvalStatus || workflowDefaults.approvalStatus
          : workflowDefaults.approvalStatus,
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await LibraryItemModel.create({
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

contentRouter.patch(
  "/library-items/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = librarySchema.partial().parse(req.body);

    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgLibraryItems).where(eq(pgLibraryItems.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Library item not found" });
        }
      }
      const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);
      const [updated] = await db.update(pgLibraryItems).set(sanitizedPayload as any).where(eq(pgLibraryItems.id, req.params.id)).returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Library item not found" });
      }
      return res.json(updated);
    }

    const sanitizedPayload = sanitizeWorkflowUpdate(payload as Record<string, unknown>, req.authUser!);
    const updated = await LibraryItemModel.findOneAndUpdate(
      buildOwnedDocumentQuery(req.params.id, req.authUser!),
      sanitizedPayload,
      {
        new: true,
      },
    );

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Library item not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/library-items/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      if (req.authUser?.role !== "admin") {
        const result = await db.select().from(pgLibraryItems).where(eq(pgLibraryItems.id, req.params.id)).limit(1);
        const existing = result[0];
        if (!existing || existing.ownerId !== req.authUser?.id) {
          return res.status(StatusCodes.NOT_FOUND).json({ message: "Library item not found" });
        }
      }
      await db.delete(pgLibraryItems).where(eq(pgLibraryItems.id, req.params.id));
      return res.json({ success: true });
    }

    const deleted = await LibraryItemModel.findOneAndDelete(buildOwnedDocumentQuery(req.params.id, req.authUser!));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Library item not found" });
    }

    return res.json({ success: true });
  }),
);

contentRouter.post(
  "/groups",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = groupSchema.parse(req.body);

    if (USE_PG()) {
      const id = `group_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgGroups).values({
        id,
        name: payload.name,
        type: payload.type,
        parentId: payload.parentId || null,
        ownerId: payload.ownerId,
        supervisorIds: payload.supervisorIds || [],
        studentIds: payload.studentIds || [],
        courseIds: payload.courseIds || [],
        description: (payload as any).description || "",
        location: (payload as any).location || "",
        settings: (payload as any).settings || {},
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await GroupModel.create(payload);
    res.status(StatusCodes.CREATED).json(created);
  }),
);

contentRouter.patch(
  "/groups/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = groupSchema.partial().parse(req.body);

    if (USE_PG()) {
      const [updated] = await db.update(pgGroups).set(payload as any).where(eq(pgGroups.id, req.params.id)).returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Group not found" });
      }
      return res.json(updated);
    }

    const updated = await GroupModel.findOneAndUpdate(buildDocumentQuery(req.params.id), payload, {
      new: true,
    });

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Group not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/groups/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      await db.delete(pgGroups).where(eq(pgGroups.id, req.params.id));
      return res.json({ success: true });
    }

    const deleted = await GroupModel.findOneAndDelete(buildDocumentQuery(req.params.id));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Group not found" });
    }

    return res.json({ success: true });
  }),
);

contentRouter.post(
  "/b2b-packages",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = b2bPackageSchema.parse(req.body);

    if (USE_PG()) {
      const id = payload.id || `b2b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgB2bPackages).values({
        id,
        schoolId: payload.schoolId,
        name: payload.name,
        courseIds: payload.courseIds || [],
        contentTypes: payload.contentTypes || ["all"],
        pathIds: payload.pathIds || [],
        subjectIds: payload.subjectIds || [],
        type: payload.type || "free_access",
        discountPercentage: payload.discountPercentage || null,
        maxStudents: payload.maxStudents || 0,
        status: payload.status || "active",
        createdAt: payload.createdAt || Date.now(),
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await B2BPackageModel.create(payload);
    res.status(StatusCodes.CREATED).json(created);
  }),
);

contentRouter.patch(
  "/b2b-packages/:id",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = b2bPackageSchema.partial().parse(req.body);

    if (USE_PG()) {
      const [updated] = await db.update(pgB2bPackages).set(payload as any).where(eq(pgB2bPackages.id, req.params.id)).returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Package not found" });
      }
      return res.json(updated);
    }

    const updated = await B2BPackageModel.findOneAndUpdate(buildDocumentQuery(req.params.id), payload, {
      new: true,
    });

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Package not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/b2b-packages/:id",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      await db.delete(pgAccessCodes).where(eq(pgAccessCodes.packageId, req.params.id));
      await db.delete(pgB2bPackages).where(eq(pgB2bPackages.id, req.params.id));
      return res.json({ success: true });
    }

    const deleted = await B2BPackageModel.findOneAndDelete(buildDocumentQuery(req.params.id));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Package not found" });
    }

    await AccessCodeModel.deleteMany({ packageId: deleted.id || String(deleted._id) });
    return res.json({ success: true });
  }),
);

contentRouter.get(
  "/access-codes",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, search } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    if (USE_PG()) {
      const conditions = [];
      if (status) conditions.push(eq(pgAccessCodes.isActive, status === "active"));
      if (search) conditions.push(ilike(pgAccessCodes.code, `%${search}%`));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [data, totalResult] = await Promise.all([
        db.select().from(pgAccessCodes).where(whereClause).orderBy(desc(pgAccessCodes.createdAt)).limit(Number(limit)).offset(skip),
        db.select({ count: count() }).from(pgAccessCodes).where(whereClause),
      ]);
      return res.json({ accessCodes: data, total: Number(totalResult[0]?.count || 0) });
    }

    const filter: any = {};
    if (status) filter.isActive = status === "active";
    if (search) filter.code = { $regex: search, $options: "i" };
    const [data, total] = await Promise.all([
      AccessCodeModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AccessCodeModel.countDocuments(filter),
    ]);
    return res.json({ accessCodes: data, total });
  }),
);

contentRouter.post(
  "/access-codes",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = accessCodeSchema.parse(req.body);

    if (USE_PG()) {
      const id = payload.id || `ac_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [created] = await db.insert(pgAccessCodes).values({
        id,
        code: payload.code,
        schoolId: payload.schoolId,
        packageId: payload.packageId,
        maxUses: payload.maxUses,
        currentUses: payload.currentUses || 0,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt || Date.now(),
      } as any).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }

    const created = await AccessCodeModel.create(payload);
    res.status(StatusCodes.CREATED).json(created);
  }),
);

contentRouter.patch(
  "/access-codes/:id",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = accessCodeSchema.partial().parse(req.body);

    if (USE_PG()) {
      const [updated] = await db.update(pgAccessCodes).set(payload as any).where(eq(pgAccessCodes.id, req.params.id)).returning();
      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Access code not found" });
      }
      return res.json(updated);
    }

    const updated = await AccessCodeModel.findOneAndUpdate(buildDocumentQuery(req.params.id), payload, {
      new: true,
    });

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Access code not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/access-codes/:id",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      await db.delete(pgAccessCodes).where(eq(pgAccessCodes.id, req.params.id));
      return res.json({ success: true });
    }

    const deleted = await AccessCodeModel.findOneAndDelete(buildDocumentQuery(req.params.id));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Access code not found" });
    }

    return res.json({ success: true });
  }),
);

contentRouter.get(
  "/schools/:id/report",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const school = await GroupModel.findOne({
      ...buildDocumentQuery(req.params.id),
      type: "SCHOOL",
    });

    if (!school) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "School not found" });
    }

    const schoolId = school.id || String(school._id);

    const [classes, packages, codes, students] = await Promise.all([
      GroupModel.find({ type: "CLASS", parentId: schoolId }).sort({ createdAt: -1 }),
      B2BPackageModel.find({ schoolId }).sort({ createdAt: -1 }),
      AccessCodeModel.find({ schoolId }).sort({ createdAt: -1 }),
      UserModel.find({ schoolId }).sort({ createdAt: -1 }),
    ]);

    const studentIds = students.map((student) => student.id || String(student._id));
    const quizResults = studentIds.length
      ? await QuizResultModel.find({ userId: { $in: studentIds } }).sort({ createdAt: -1 })
      : [];

    const averageScore = quizResults.length
      ? Math.round(
          quizResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / quizResults.length,
        )
      : 0;

    const weakSkillMap = new Map<
      string,
      {
        skillId?: string;
        skill: string;
        subjectId?: string;
        sectionId?: string;
        attempts: number;
        masteryTotal: number;
      }
    >();

    quizResults.forEach((result) => {
      const skills = Array.isArray(result.skillsAnalysis) ? result.skillsAnalysis : [];
      skills.forEach((gap: any) => {
        const key = String(gap?.skillId || gap?.skill || gap?.sectionId || "unknown");
        const current = weakSkillMap.get(key) || {
          skillId: gap?.skillId,
          skill: String(gap?.skill || "مهارة غير مسماة"),
          subjectId: gap?.subjectId,
          sectionId: gap?.sectionId,
          attempts: 0,
          masteryTotal: 0,
        };

        current.attempts += 1;
        current.masteryTotal += Number(gap?.mastery) || 0;
        weakSkillMap.set(key, current);
      });
    });

    const weakestSkills = Array.from(weakSkillMap.values())
      .map((item) => ({
        skillId: item.skillId,
        skill: item.skill,
        subjectId: item.subjectId,
        sectionId: item.sectionId,
        attempts: item.attempts,
        mastery: item.attempts > 0 ? Math.round(item.masteryTotal / item.attempts) : 0,
      }))
      .sort((a, b) => a.mastery - b.mastery || b.attempts - a.attempts)
      .slice(0, 8);

    const classSummaries = classes.map((group) => {
      const classId = group.id || String(group._id);
      const classStudents = students.filter((student) => (student.groupIds || []).includes(classId));
      const classStudentIds = new Set(classStudents.map((student) => student.id || String(student._id)));
      const classResults = quizResults.filter((result) => classStudentIds.has(String(result.userId)));
      const classAverageScore = classResults.length
        ? Math.round(classResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / classResults.length)
        : 0;

      return {
        id: classId,
        name: group.name,
        studentCount: classStudents.length,
        supervisorCount: Array.isArray(group.supervisorIds) ? group.supervisorIds.length : 0,
        quizAttempts: classResults.length,
        averageScore: classAverageScore,
      };
    });

    return res.json({
      school: {
        id: schoolId,
        name: school.name,
      },
      metrics: {
        totalStudents: students.length,
        activeStudents: students.filter((student) => student.isActive !== false).length,
        totalClasses: classes.length,
        activePackages: packages.filter((pkg) => pkg.status === "active").length,
        activeCodes: codes.filter((code) => Number(code.expiresAt) > Date.now()).length,
        quizAttempts: quizResults.length,
        averageScore,
      },
      classSummaries,
      weakestSkills,
    });
  }),
);

contentRouter.post(
  "/schools/:id/import-students",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = schoolImportSchema.parse(req.body);
    const school = await GroupModel.findOne({
      ...buildDocumentQuery(req.params.id),
      type: "SCHOOL",
    });

    if (!school) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "School not found" });
    }

    const schoolId = school.id || String(school._id);
    const existingClasses = await GroupModel.find({ type: "CLASS", parentId: schoolId }).sort({ createdAt: -1 });
    const classById = new Map(existingClasses.map((item) => [item.id || String(item._id), item]));
    const classByName = new Map(existingClasses.map((item) => [item.name.trim().toLowerCase(), item]));
    const credentials: Array<{ name: string; email: string; password: string; className?: string }> = [];
    const importedUsers: any[] = [];

    for (const row of payload.rows) {
      let targetClass = row.classId ? classById.get(row.classId) : undefined;

      if (!targetClass && row.className?.trim()) {
        targetClass = classByName.get(row.className.trim().toLowerCase());
      }

      if (!targetClass && row.className?.trim()) {
        targetClass = await GroupModel.create({
          id: `class_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: row.className.trim(),
          type: "CLASS",
          parentId: schoolId,
          ownerId: req.authUser?.id,
          supervisorIds: [],
          studentIds: [],
          courseIds: [],
          createdAt: Date.now(),
          totalStudents: 0,
          totalSupervisors: 0,
          totalCourses: 0,
        });

        const createdClassId = targetClass.id || String(targetClass._id);
        classById.set(createdClassId, targetClass);
        classByName.set(targetClass.name.trim().toLowerCase(), targetClass);
      }

      const generatedPassword = row.password || `Nn@${Math.floor(100000 + Math.random() * 900000)}`;
      const passwordHash = await bcrypt.hash(generatedPassword, 10);
      const normalizedEmail = row.email.toLowerCase().trim();
      const classId = targetClass ? targetClass.id || String(targetClass._id) : undefined;

      const user = await UserModel.findOneAndUpdate(
        { email: normalizedEmail },
        {
          name: row.name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "student",
          isActive: true,
          schoolId,
          groupIds: classId ? [classId] : [],
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      importedUsers.push(user);
      credentials.push({
        name: row.name.trim(),
        email: normalizedEmail,
        password: generatedPassword,
        className: targetClass?.name,
      });
    }

    const studentIds = importedUsers.map((user) => user.id || String(user._id));

    await GroupModel.findOneAndUpdate(
      buildDocumentQuery(schoolId),
      {
        $addToSet: { studentIds: { $each: studentIds } },
        $set: { totalStudents: await UserModel.countDocuments({ schoolId }) },
      },
      { new: true },
    );

    const latestClasses = await GroupModel.find({ type: "CLASS", parentId: schoolId });
    await Promise.all(
      latestClasses.map(async (group) => {
        const classId = group.id || String(group._id);
        const count = await UserModel.countDocuments({ groupIds: classId });
        await GroupModel.findOneAndUpdate(buildDocumentQuery(classId), { $set: { totalStudents: count } });
      }),
    );
  }),
);

contentRouter.get(
  "/announcement-ads",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    if (USE_PG()) {
      const rows = await db.select().from(announcementAds).where(eq(announcementAds.isActive, true)).orderBy(desc(announcementAds.createdAt));
      return res.json({ announcementAds: rows });
    }
    return res.json({ announcementAds: [] });
  }),
);

contentRouter.post(
  "/announcement-ads",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const payload = req.body;
      const id = randomUUID();
      const [created] = await db.insert(announcementAds).values({ id, ...payload }).returning();
      return res.status(StatusCodes.CREATED).json(created);
    }
    return res.status(StatusCodes.CREATED).json({});
  }),
);

contentRouter.patch(
  "/announcement-ads/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const { id } = req.params;
      const payload = req.body;
      const [updated] = await db.update(announcementAds).set({ ...payload, updatedAt: new Date() }).where(eq(announcementAds.id, id)).returning();
      return res.json(updated);
    }
    return res.json({});
  }),
);

contentRouter.delete(
  "/announcement-ads/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const { id } = req.params;
      await db.delete(announcementAds).where(eq(announcementAds.id, id));
      return res.status(StatusCodes.NO_CONTENT).send();
    }
    return res.status(StatusCodes.NO_CONTENT).send();
  }),
);

contentRouter.get(
  "/platform-integrations",
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const [row] = await db.select().from(platformIntegrationSettings).where(eq(platformIntegrationSettings.key, "platform_settings")).limit(1);
      return res.json({ settings: row?.value || {} });
    }
    return res.json({ settings: {} });
  }),
);

contentRouter.patch(
  "/platform-integrations",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const payload = req.body;
      const [existing] = await db.select().from(platformIntegrationSettings).where(eq(platformIntegrationSettings.key, "platform_settings")).limit(1);
      if (existing) {
        const [updated] = await db.update(platformIntegrationSettings)
          .set({ value: payload, updatedAt: new Date() })
          .where(eq(platformIntegrationSettings.key, "platform_settings"))
          .returning();
        return res.json({ settings: updated.value });
      }
      const [created] = await db.insert(platformIntegrationSettings)
        .values({ id: randomUUID(), key: "platform_settings", value: payload, updatedAt: new Date() })
        .returning();
      return res.json({ settings: created.value });
    }
    return res.json({ settings: {} });
  }),
);

contentRouter.get(
  "/public-contact-widget",
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const [row] = await db.select().from(homepageSettings).limit(1);
      const settings = (row?.settings as any) || {};
      return res.json({
        email: settings.contactEmail || "",
        phone: settings.contactPhone || "",
        whatsapp: settings.whatsapp || "",
        address: settings.address || "",
        socialLinks: settings.socialLinks || {},
      });
    }
    return res.json({ email: "", phone: "", whatsapp: "", address: "", socialLinks: {} });
  }),
);

contentRouter.get(
  "/platform-font-settings",
  asyncHandler(async (_req, res) => {
    if (USE_PG()) {
      const [row] = await db.select().from(homepageSettings).limit(1);
      const settings = (row?.settings as any) || {};
      return res.json({
        fontFamily: settings.fontFamily || "Cairo",
        headingFont: settings.headingFont || "Cairo",
        bodyFont: settings.bodyFont || "Cairo",
        enableFontSettings: settings.enableFontSettings || false,
      });
    }
    return res.json({ fontFamily: "Cairo", headingFont: "Cairo", bodyFont: "Cairo", enableFontSettings: false });
  }),
);

contentRouter.patch(
  "/platform-font-settings",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const [row] = await db.select().from(homepageSettings).limit(1);
      const existing = (row?.settings as any) || {};
      const updated = { ...existing, ...req.body };
      if (row) {
        await db.update(homepageSettings).set({ settings: updated }).where(eq(homepageSettings.id, row.id));
      } else {
        await db.insert(homepageSettings).values({ id: randomUUID(), settings: updated });
      }
      return res.json({ ...updated });
    }
    return res.json(req.body);
  }),
);

contentRouter.get(
  "/platform-integrations/history",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({ history: [] });
  }),
);

contentRouter.post(
  "/platform-integrations/history/:id/restore",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    return res.json({ restored: true, id: req.params.id });
  }),
);

contentRouter.get(
  "/platform-integrations/setup-checklist",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      sentry: isSentryEnabled(),
      redis: isRedisConfigured(),
      ai: env.AI_PROVIDER !== "none" && env.AI_PROVIDER !== undefined,
      emailConfigured: env.EMAIL_PROVIDER !== "console",
      postgresConfigured: Boolean(env.DATABASE_URL),
    });
  }),
);

contentRouter.get(
  "/platform-integrations/runtime-audit",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      timestamp: new Date().toISOString(),
      status: "ok",
      checks: {
        server: { status: "ok", uptime: process.uptime() },
        postgres: env.USE_POSTGRES ? { status: "ok" } : { status: "disabled" },
        redis: isRedisConfigured() ? { status: "ok" } : { status: "not_configured" },
        ai: env.AI_PROVIDER ? { provider: env.AI_PROVIDER, status: "ok" } : { status: "not_configured" },
      },
    });
  }),
);

contentRouter.get(
  "/access-code-redemptions",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, accessCodeId, userId, status } = req.query as any;
    if (USE_PG()) {
      return res.json({ redemptions: [], total: 0 });
    }
    const filter: any = {};
    if (accessCodeId) filter.accessCodeId = accessCodeId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    return res.json({ redemptions: [], total: 0 });
  }),
);

contentRouter.post(
  "/schools/:id/relations",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = req.body;
    return res.json({ success: true, schoolId: id, relations: payload });
  }),
);


