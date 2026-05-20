import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { AiInteractionModel } from "../models/AiInteraction.js";
import { AdminAuditLogModel } from "../models/AdminAuditLog.js";
import { BackupSnapshotModel } from "../models/BackupSnapshot.js";
import { ClientEventModel } from "../models/ClientEvent.js";
import { CourseModel } from "../models/Course.js";
import { LessonModel } from "../models/Lesson.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { PathModel } from "../models/Path.js";
import { QuizModel } from "../models/Quiz.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { SkillProgressModel } from "../models/SkillProgress.js";
import { SubjectModel } from "../models/Subject.js";
import { TopicModel } from "../models/Topic.js";
import { createOperationsAudit } from "../services/operationsAudit.js";
import { runOperationsRepair, type OperationsRepairAction } from "../services/operationsRepair.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";
import { env } from "../config/env.js";
import { getRedisHealth, isRedisConfigured } from "../config/redis.js";
import { captureSentryMessage, isSentryEnabled } from "../observability/sentry.js";

export const operationsRouter = Router();

const clientEventSchema = z.object({
  severity: z.enum(["info", "warning", "error"]).default("error"),
  source: z
    .enum(["app", "error-boundary", "unhandled-error", "unhandled-rejection", "video-player", "api", "manual"])
    .default("app"),
  message: z.string().min(1).max(800),
  stack: z.string().max(3000).optional().default(""),
  path: z.string().max(500).optional().default(""),
  appVersion: z.string().max(120).optional().default(""),
  userAgent: z.string().max(500).optional().default(""),
  metadata: z.record(z.any()).optional().default({}),
});

const resolveClientEventsSchema = z.object({
  severity: z.enum(["info", "warning", "error"]).optional(),
  source: z
    .enum(["app", "error-boundary", "unhandled-error", "unhandled-rejection", "video-player", "api", "manual"])
    .optional(),
});

const idOf = (item: any) => String(item?.id || item?._id || "");

const safeString = (value: unknown, maxLength: number) => String(value || "").slice(0, maxLength);

const isVisibleContent = (item: any) =>
  item?.showOnPlatform !== false &&
  item?.isPublished !== false &&
  (!item?.approvalStatus || item.approvalStatus === "approved");

const sanitizeVideoUrl = (rawUrl?: string | null) => {
  if (!rawUrl) return "";

  let trimmedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmedUrl) return "";

  trimmedUrl = trimmedUrl
    .replace(/^https?:\/\/https?:\/\//i, "https://")
    .replace(/^https?:\/\/:\/\//i, "https://")
    .replace(/^:\/\//, "https://")
    .replace(/^\/\//, "https://");

  if (/^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(trimmedUrl)) {
    return `https://${trimmedUrl}`;
  }

  return trimmedUrl;
};

const hasPlayableLessonMedia = (lesson: any) =>
  Boolean(
    sanitizeVideoUrl(lesson?.videoUrl) ||
      String(lesson?.fileUrl || "").trim() ||
      String(lesson?.content || "").trim() ||
      String(lesson?.recordingUrl || "").trim(),
  );

const OPERATIONS_STATUS_CACHE_TTL_MS = 30 * 1000;
const OPERATIONS_STATUS_PATH_SELECT = "_id id name isActive";
const OPERATIONS_STATUS_SUBJECT_SELECT = "_id id name pathId";
const OPERATIONS_STATUS_TOPIC_SELECT = "_id id title name pathId subjectId lessonIds quizIds showOnPlatform";
const OPERATIONS_STATUS_LESSON_SELECT =
  "_id id title name pathId subjectId showOnPlatform isPublished approvalStatus videoUrl fileUrl content recordingUrl";
const OPERATIONS_STATUS_QUIZ_SELECT = "_id id title name pathId subjectId showOnPlatform isPublished approvalStatus";
const OPERATIONS_STATUS_COURSE_SELECT = "_id id title name pathId category subjectId subject showOnPlatform isPublished approvalStatus";
const OPERATIONS_STATUS_LIBRARY_SELECT = "_id id title name pathId subjectId showOnPlatform isPublished approvalStatus";
let cachedOperationsStatus: { expiresAt: number; payload: unknown } | null = null;
let pendingOperationsStatus: Promise<unknown> | null = null;

operationsRouter.get("/status", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    if (cachedOperationsStatus && cachedOperationsStatus.expiresAt > Date.now()) {
      res.setHeader("X-Operations-Status-Cache", "hit");
      return res.json(cachedOperationsStatus.payload);
    }

    if (pendingOperationsStatus) {
      const payload = await pendingOperationsStatus;
      res.setHeader("X-Operations-Status-Cache", "shared");
      return res.json(payload);
    }

    const loadStatusPayload = async () => {
      const [paths, subjects, topics, lessons, quizzes, courses, libraryItems] = await Promise.all([
        PathModel.find().select(OPERATIONS_STATUS_PATH_SELECT).lean(),
        SubjectModel.find().select(OPERATIONS_STATUS_SUBJECT_SELECT).lean(),
        TopicModel.find().select(OPERATIONS_STATUS_TOPIC_SELECT).lean(),
        LessonModel.find().select(OPERATIONS_STATUS_LESSON_SELECT).lean(),
        QuizModel.find().select(OPERATIONS_STATUS_QUIZ_SELECT).lean(),
        CourseModel.find().select(OPERATIONS_STATUS_COURSE_SELECT).lean(),
        LibraryItemModel.find().select(OPERATIONS_STATUS_LIBRARY_SELECT).lean(),
      ]);

      const activePathIds = new Set(paths.filter((path: any) => path.isActive !== false).map(idOf));
      const visibleSubjects = subjects.filter((subject: any) => activePathIds.has(subject.pathId));
      const visibleTopics = topics.filter((topic: any) => topic.showOnPlatform !== false && activePathIds.has(topic.pathId));
      const visibleLessons = lessons.filter((lesson: any) => isVisibleContent(lesson) && activePathIds.has(lesson.pathId));
      const visibleQuizzes = quizzes.filter((quiz: any) => isVisibleContent(quiz) && activePathIds.has(quiz.pathId));
      const visibleCourses = courses.filter((course: any) => isVisibleContent(course) && activePathIds.has(course.pathId || course.category));
      const visibleLibraryItems = libraryItems.filter((item: any) => isVisibleContent(item) && activePathIds.has(item.pathId));

      const pathById = new Map(paths.map((path: any) => [idOf(path), path]));
      const visibleSubjectIds = new Set(visibleSubjects.map(idOf));
      const lessonIds = new Set(visibleLessons.map(idOf));
      const quizIds = new Set(visibleQuizzes.map(idOf));
      const lessonById = new Map(visibleLessons.map((lesson: any) => [idOf(lesson), lesson]));

      const spaces = visibleSubjects.map((subject: any) => {
        const subjectId = idOf(subject);
        const pathId = subject.pathId;
        const spaceTopics = visibleTopics.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId);
        const topicCount = spaceTopics.length;
        const lessonCount = visibleLessons.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId).length;
        const quizCount = visibleQuizzes.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId).length;
        const courseCount = visibleCourses.filter(
          (item: any) => (item.pathId || item.category) === pathId && (item.subjectId || item.subject) === subjectId,
        ).length;
        const libraryCount = visibleLibraryItems.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId).length;
        const missingLessonRefs = spaceTopics.reduce(
          (total: number, topic: any) => total + (topic.lessonIds || []).filter((lessonId: string) => !lessonIds.has(String(lessonId))).length,
          0,
        );
        const missingQuizRefs = spaceTopics.reduce(
          (total: number, topic: any) => total + (topic.quizIds || []).filter((quizId: string) => !quizIds.has(String(quizId))).length,
          0,
        );
        const unplayableLinkedLessons = spaceTopics.reduce(
          (total: number, topic: any) =>
            total +
            (topic.lessonIds || []).filter((lessonId: string) => {
              const lesson = lessonById.get(String(lessonId));
              return lesson && !hasPlayableLessonMedia(lesson);
            }).length,
          0,
        );
        const issueCount = missingLessonRefs + missingQuizRefs + unplayableLinkedLessons;
        const total = topicCount + lessonCount + quizCount + courseCount + libraryCount;

        return {
          pathId,
          pathName: pathById.get(pathId)?.name || pathId,
          subjectId,
          subjectName: subject.name,
          total,
          topics: topicCount,
          lessons: lessonCount,
          quizzes: quizCount,
          courses: courseCount,
          library: libraryCount,
          issueCount,
          missingLessonRefs,
          missingQuizRefs,
          unplayableLinkedLessons,
          status: total === 0 ? "empty" : issueCount > 0 ? "needs_attention" : "ready",
        };
      });

      const missingTopicSubjects = visibleTopics.filter((topic: any) => topic.subjectId && !visibleSubjectIds.has(topic.subjectId)).length;
      const missingLessonRefs = visibleTopics.reduce(
        (total: number, topic: any) => total + (topic.lessonIds || []).filter((lessonId: string) => !lessonIds.has(String(lessonId))).length,
        0,
      );
      const missingQuizRefs = visibleTopics.reduce(
        (total: number, topic: any) => total + (topic.quizIds || []).filter((quizId: string) => !quizIds.has(String(quizId))).length,
        0,
      );
      const unplayableLinkedLessons = visibleTopics.reduce(
        (total: number, topic: any) =>
          total +
          (topic.lessonIds || []).filter((lessonId: string) => {
            const lesson = lessonById.get(String(lessonId));
            return lesson && !hasPlayableLessonMedia(lesson);
          }).length,
        0,
      );

      const emptySpaces = spaces.filter((space) => space.total === 0).length;
      const usableSpaces = spaces.filter((space) => space.total > 0).length;
      const issueCount = missingTopicSubjects + missingLessonRefs + missingQuizRefs + unplayableLinkedLessons + emptySpaces;
      const readinessScore = spaces.length
        ? Math.max(0, Math.min(100, Math.round(((spaces.length - emptySpaces) / spaces.length) * 70 + (issueCount === 0 ? 30 : 0))))
        : 0;

      return {
        checkedAt: new Date().toISOString(),
        database: {
          status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
          name: mongoose.connection.db?.databaseName || "unknown",
        },
        counts: {
          paths: paths.length,
          subjects: subjects.length,
          topics: topics.length,
          lessons: lessons.length,
          quizzes: quizzes.length,
          courses: courses.length,
          libraryItems: libraryItems.length,
        },
        visible: {
          paths: activePathIds.size,
          subjects: visibleSubjects.length,
          topics: visibleTopics.length,
          lessons: visibleLessons.length,
          quizzes: visibleQuizzes.length,
          courses: visibleCourses.length,
          libraryItems: visibleLibraryItems.length,
        },
        learningReadiness: {
          score: readinessScore,
          usableSpaces,
          emptySpaces,
          readySpaces: spaces.filter((space) => space.status === "ready").length,
          spacesNeedingAttention: spaces.filter((space) => space.status === "needs_attention").length,
          spaces: spaces.slice(0, 12),
        },
        issues: {
          missingTopicSubjects,
          missingLessonRefs,
          missingQuizRefs,
          unplayableLinkedLessons,
        },
        deployment: {
          api: "Render",
          database: "MongoDB Atlas",
          frontend: "Vercel",
          nodeEnv: process.env.NODE_ENV || "development",
          clientUrl: process.env.CLIENT_URL || "",
        },
      };
    };

    pendingOperationsStatus = loadStatusPayload()
      .then((payload) => {
        cachedOperationsStatus = {
          expiresAt: Date.now() + OPERATIONS_STATUS_CACHE_TTL_MS,
          payload,
        };
        return payload;
      })
      .finally(() => {
        pendingOperationsStatus = null;
      });

    const payload = await pendingOperationsStatus;
    res.setHeader("X-Operations-Status-Cache", "miss");
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/audit", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    res.json(await createOperationsAudit());
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/delivery-readiness", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const audit = await createOperationsAudit();

    const [
      latestBackup,
      unresolvedClientErrors,
      clientErrors24h,
      aiErrors24h,
      studentChats24h,
      personalizedStudentChats7d,
      studentsWithResults,
      weakSkillSignals,
    ] = await Promise.all([
      BackupSnapshotModel.findOne({ kind: "learning-content" }).sort({ createdAt: -1 }).lean(),
      ClientEventModel.countDocuments({ resolved: false, severity: "error" }),
      ClientEventModel.countDocuments({ severity: "error", createdAt: { $gte: since24h } }),
      AiInteractionModel.countDocuments({ status: "error", createdAt: { $gte: since24h } }),
      AiInteractionModel.countDocuments({ endpoint: "/ai/chat", audience: "student", createdAt: { $gte: since24h } }),
      AiInteractionModel.countDocuments({ endpoint: "/ai/chat", audience: "student", personalized: true, createdAt: { $gte: since7d } }),
      QuizResultModel.distinct("userId").then((ids) => ids.length),
      SkillProgressModel.countDocuments({ status: { $in: ["weak", "average"] } }),
    ]);

    const backupCreatedAt = latestBackup?.createdAt ? new Date(latestBackup.createdAt) : null;
    const backupAgeHours = backupCreatedAt ? Math.round((Date.now() - backupCreatedAt.getTime()) / (60 * 60 * 1000)) : null;
    const backupFresh = typeof backupAgeHours === "number" && backupAgeHours <= 72;
    const backupOld = typeof backupAgeHours === "number" && backupAgeHours > 72 && backupAgeHours <= 24 * 14;

    const checks = [
      {
        id: "database",
        title: "قاعدة البيانات",
        status: mongoose.connection.readyState === 1 ? "pass" : "fail",
        detail: mongoose.connection.readyState === 1 ? `متصل بقاعدة ${mongoose.connection.db?.databaseName || "MongoDB"}.` : "الخادم غير متصل بقاعدة البيانات.",
        action: "راجع MONGODB_URI في Render وأعد النشر عند الحاجة.",
        routeHint: "",
      },
      {
        id: "content",
        title: "رحلة الطالب والمحتوى",
        status: audit.totals.critical > 0 ? "fail" : audit.score >= 80 ? "pass" : "warning",
        detail: `درجة الفحص ${audit.score}/100، حرجة ${audit.totals.critical}، تنبيهات ${audit.totals.warnings}.`,
        action: "افتح مركز القيادة وعالج أولويات المحتوى قبل التسليم النهائي.",
        routeHint: "#/admin-dashboard?tab=monitoring",
      },
      {
        id: "backup",
        title: "النسخ الاحتياطي",
        status: backupFresh ? "pass" : backupOld ? "warning" : "fail",
        detail: backupCreatedAt
          ? `آخر نسخة محفوظة منذ ${backupAgeHours} ساعة، وبها ${latestBackup?.totalDocuments || 0} عنصر.`
          : "لا توجد نسخة احتياطية محفوظة على السيرفر حتى الآن.",
        action: "افتح النسخ الاحتياطي واحفظ نسخة قبل أي دفعة محتوى كبيرة أو قبل التسليم.",
        routeHint: "#/admin-dashboard?tab=backups",
      },
      {
        id: "client-errors",
        title: "أخطاء الواجهة",
        status: unresolvedClientErrors > 0 ? "fail" : clientErrors24h > 0 ? "warning" : "pass",
        detail: `أخطاء آخر 24 ساعة: ${clientErrors24h}، غير مغلقة: ${unresolvedClientErrors}.`,
        action: "راجع سجل أخطاء الواجهة داخل مركز القيادة عند ظهور أي صفحة بيضاء أو خطأ فيديو.",
        routeHint: "#/admin-dashboard?tab=monitoring",
      },
      {
        id: "ai",
        title: "المساعد الذكي",
        status: aiErrors24h > 0 ? "warning" : studentsWithResults > 0 ? "pass" : "warning",
        detail: `طلاب لديهم نتائج: ${studentsWithResults}، إشارات مهارية: ${weakSkillSignals}، محادثات طالب آخر 24 ساعة: ${studentChats24h}.`,
        action: "اربط مزود ذكاء من Render عند الحاجة، واجعل الطلاب يجرون اختبارات حتى يصبح التوجيه شخصيا.",
        routeHint: "#/admin-dashboard?tab=ai-assistant",
      },
      {
        id: "personalization",
        title: "التوجيه الشخصي",
        status: personalizedStudentChats7d > 0 || weakSkillSignals > 0 ? "pass" : "warning",
        detail: `محادثات شخصية آخر 7 أيام: ${personalizedStudentChats7d}.`,
        action: "اربط نتائج الاختبارات بالمهارات حتى يعرف المساعد نقاط ضعف الطالب.",
        routeHint: "#/admin-dashboard?tab=questions",
      },
    ];

    const failed = checks.filter((item) => item.status === "fail").length;
    const warnings = checks.filter((item) => item.status === "warning").length;
    const score = Math.max(0, Math.min(100, Math.round(100 - failed * 18 - warnings * 7)));

    res.json({
      checkedAt: new Date().toISOString(),
      score,
      status: failed > 0 ? "blocked" : warnings > 0 ? "ready_with_notes" : "ready",
      summary: {
        failed,
        warnings,
        passed: checks.filter((item) => item.status === "pass").length,
        auditScore: audit.score,
        latestBackupAt: backupCreatedAt?.toISOString() || "",
        backupAgeHours,
        clientErrors24h,
        aiErrors24h,
      },
      checks,
      nextActions: checks
        .filter((item) => item.status !== "pass")
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          title: item.title,
          action: item.action,
          routeHint: item.routeHint,
        })),
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/integrations-readiness", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const redisHealth = await getRedisHealth("queue", { required: true, timeoutMs: 1200 });
    const redisRequiredByQueue = env.NOTIFICATION_QUEUE_ENABLED;
    const redisRequiredByRateLimit = env.RATE_LIMIT_REDIS_ENABLED;

    const googleConfigured =
      Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim()) &&
      Boolean(env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CLIENT_SECRET.trim()) &&
      Boolean(env.GOOGLE_REDIRECT_URI && env.GOOGLE_REDIRECT_URI.trim());

    const emailProvider = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
    const emailConfigured =
      emailProvider === "console" ||
      (emailProvider === "resend" &&
        Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) &&
        Boolean(process.env.EMAIL_FROM && process.env.EMAIL_FROM.trim())) ||
      (emailProvider === "http" && Boolean(process.env.EMAIL_WEBHOOK_URL && process.env.EMAIL_WEBHOOK_URL.trim()));

    const whatsappProvider = String(process.env.WHATSAPP_PROVIDER || "").trim().toLowerCase();
    const whatsappConfigured =
      whatsappProvider === "console" ||
      (whatsappProvider === "whatsapp_cloud" &&
        Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN.trim()) &&
        Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_PHONE_NUMBER_ID.trim())) ||
      (whatsappProvider === "http" && Boolean(process.env.WHATSAPP_WEBHOOK_URL && process.env.WHATSAPP_WEBHOOK_URL.trim()));

    const sentryConfigured = Boolean(env.SENTRY_DSN && env.SENTRY_DSN.trim());

    const checks = [
      {
        id: "google_oauth",
        title: "Google OAuth",
        status: env.GOOGLE_OAUTH_ENABLED ? (googleConfigured ? "pass" : "fail") : "warning",
        detail: env.GOOGLE_OAUTH_ENABLED
          ? googleConfigured
            ? "Google OAuth environment variables are configured."
            : "Google OAuth is enabled but one or more required variables are missing."
          : "Google OAuth is currently disabled by configuration.",
        requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_OAUTH_ENABLED=true"],
      },
      {
        id: "email_provider",
        title: "Email Provider",
        status: emailConfigured ? "pass" : "fail",
        detail: emailConfigured
          ? `Email provider "${emailProvider || "unknown"}" is configured.`
          : "Email provider credentials are incomplete or provider is not selected.",
        requiredEnv: [
          "EMAIL_PROVIDER=resend|http|console",
          "EMAIL_FROM (for resend)",
          "RESEND_API_KEY (for resend)",
          "EMAIL_WEBHOOK_URL (for http provider)",
        ],
      },
      {
        id: "whatsapp_provider",
        title: "WhatsApp Provider",
        status: whatsappConfigured ? "pass" : "warning",
        detail: whatsappConfigured
          ? `WhatsApp provider "${whatsappProvider || "unknown"}" is configured.`
          : "WhatsApp provider is optional now but not fully configured.",
        requiredEnv: [
          "WHATSAPP_PROVIDER=whatsapp_cloud|http|console",
          "WHATSAPP_ACCESS_TOKEN (for whatsapp_cloud)",
          "WHATSAPP_PHONE_NUMBER_ID (for whatsapp_cloud)",
          "WHATSAPP_WEBHOOK_URL (for http provider)",
        ],
      },
      {
        id: "sentry",
        title: "Sentry",
        status: sentryConfigured ? "pass" : "warning",
        detail: sentryConfigured
          ? "Sentry DSN is configured. Runtime SDK wiring can send production errors."
          : "Sentry DSN is not configured yet.",
        requiredEnv: ["SENTRY_DSN", "SENTRY_ENVIRONMENT", "SENTRY_TRACES_SAMPLE_RATE"],
      },
      {
        id: "managed_redis",
        title: "Managed Redis",
        status: redisHealth.ok ? "pass" : redisRequiredByQueue || redisRequiredByRateLimit ? "fail" : "warning",
        detail: redisHealth.ok
          ? `Redis is reachable (${redisHealth.latencyMs ?? "?"} ms).`
          : isRedisConfigured()
          ? `Redis configured but unhealthy: ${redisHealth.error || redisHealth.status}`
          : "REDIS_URL is not configured.",
        requiredEnv: ["REDIS_URL", "REDIS_KEY_PREFIX", "NOTIFICATION_QUEUE_ENABLED", "RATE_LIMIT_REDIS_ENABLED"],
      },
    ];

    const failed = checks.filter((item) => item.status === "fail").length;
    const warnings = checks.filter((item) => item.status === "warning").length;
    const score = Math.max(0, Math.min(100, Math.round(100 - failed * 22 - warnings * 8)));

    return res.json({
      checkedAt: new Date().toISOString(),
      score,
      status: failed > 0 ? "blocked" : warnings > 0 ? "ready_with_notes" : "ready",
      checks,
      summary: {
        failed,
        warnings,
        passed: checks.filter((item) => item.status === "pass").length,
      },
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/client-events", optionalAuth, async (req, res, next) => {
  try {
    const payload = clientEventSchema.parse(req.body || {});
    const authUser = req.authUser;

    await ClientEventModel.create({
      severity: payload.severity,
      source: payload.source,
      message: safeString(payload.message, 800),
      stack: safeString(payload.stack, 3000),
      path: safeString(payload.path, 500),
      appVersion: safeString(payload.appVersion, 120),
      userAgent: safeString(payload.userAgent, 500),
      userId: authUser?.id || "",
      userEmail: authUser?.email || "",
      role: authUser?.role || "",
      metadata: payload.metadata,
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/client-events", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const pagination = resolvePagination(req.query, { limit: 25 });
    const severity = String(req.query.severity || "");
    const filter = ["info", "warning", "error"].includes(severity) ? { severity } : {};
    const [events, total, unresolvedCount, last24hCount] = await Promise.all([
      ClientEventModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      ClientEventModel.countDocuments(filter),
      ClientEventModel.countDocuments({ resolved: false }),
      ClientEventModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.json({
      events,
      pagination: buildPaginatedResponse([], pagination, total),
      summary: {
        unresolvedCount,
        last24hCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.get("/admin-audit-logs", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const pagination = resolvePagination(req.query, { limit: 50 });
    const action = safeString(req.query.action, 160);
    const status = safeString(req.query.status, 30);
    const filter: Record<string, unknown> = {};

    if (action) {
      filter.action = action;
    }
    if (["success", "blocked", "failed"].includes(status)) {
      filter.status = status;
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [logs, total, blockedCount24h, failedCount24h] = await Promise.all([
      AdminAuditLogModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      AdminAuditLogModel.countDocuments(filter),
      AdminAuditLogModel.countDocuments({ status: "blocked", createdAt: { $gte: since24h } }),
      AdminAuditLogModel.countDocuments({ status: "failed", createdAt: { $gte: since24h } }),
    ]);

    res.json({
      logs,
      pagination: buildPaginatedResponse([], pagination, total),
      summary: {
        blockedCount24h,
        failedCount24h,
      },
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.patch("/client-events/:id/resolve", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid client event id" });
    }

    const authUser = req.authUser;
    const event = await ClientEventModel.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: authUser?.id || "",
          resolvedByEmail: authUser?.email || "",
        },
      },
      { new: true },
    ).lean();

    if (!event) {
      return res.status(404).json({ message: "Client event not found" });
    }

    res.json({ ok: true, event });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/client-events/resolve-all", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const payload = resolveClientEventsSchema.parse(req.body || {});
    const authUser = req.authUser;
    const filter: Record<string, unknown> = { resolved: false };
    if (payload.severity) {
      filter.severity = payload.severity;
    }
    if (payload.source) {
      filter.source = payload.source;
    }

    const result = await ClientEventModel.updateMany(filter, {
      $set: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: authUser?.id || "",
        resolvedByEmail: authUser?.email || "",
      },
    });

    res.json({
      ok: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/repair", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const action = String(req.body?.action || "") as OperationsRepairAction;
    const apply = req.body?.apply === true;
    if (
      ![
        "hide-empty-published-quizzes",
        "hide-empty-active-paths",
        "unlink-unavailable-topic-lessons",
        "unlink-unavailable-topic-quizzes",
      ].includes(action)
    ) {
      return res.status(400).json({
        message: "Unsupported repair action",
      });
    }

    res.json(await runOperationsRepair(action, apply));
  } catch (error) {
    next(error);
  }
});

operationsRouter.post("/sentry/test-event", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!isSentryEnabled()) {
      return res.status(412).json({
        ok: false,
        message: "Sentry is not configured on this environment",
      });
    }

    const eventId = captureSentryMessage("Manual Sentry smoke event", {
      source: "operations-test-endpoint",
      requestId: req.requestId,
      adminUserId: req.authUser?.id || "",
      adminEmail: req.authUser?.email || "",
      timestamp: new Date().toISOString(),
    });

    return res.status(202).json({
      ok: true,
      eventId: eventId || null,
      message: "Sentry test event queued",
    });
  } catch (error) {
    next(error);
  }
});
