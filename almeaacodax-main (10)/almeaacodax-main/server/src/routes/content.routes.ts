import { Router } from "express";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { z } from "zod";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { TopicModel } from "../models/Topic.js";
import { LessonModel } from "../models/Lesson.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { GroupModel } from "../models/Group.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { AccessCodeModel } from "../models/AccessCode.js";
import { AccessGrantModel } from "../models/AccessGrant.js";
import { UserModel } from "../models/User.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { HomepageSettingsModel } from "../models/HomepageSettings.js";
import { PlatformFontSettingsModel } from "../models/PlatformFontSettings.js";
import { PlatformIntegrationSettingsModel } from "../models/PlatformIntegrationSettings.js";
import { PlatformIntegrationHistoryModel } from "../models/PlatformIntegrationHistory.js";
import { StudyPlanModel } from "../models/StudyPlan.js";
import { AnnouncementAdModel } from "../models/AnnouncementAd.js";
import { getActivePathIds, isStaffRole } from "../services/visibility.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";
import { getRedisHealth, isRedisConfigured } from "../config/redis.js";
import { decryptIntegrationSecretsForRuntime, encryptIntegrationSecretsAtRest } from "../utils/integrationSecretsCrypto.js";

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
  libraryItemIds: z.array(z.string()).default([]),
});

const topicUpdateSchema = z.object({
  id: z.string().optional(),
  pathId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  sectionId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  parentId: z.string().nullable().optional(),
  order: z.number().optional(),
  showOnPlatform: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  lessonIds: z.array(z.string()).optional(),
  quizIds: z.array(z.string()).optional(),
  libraryItemIds: z.array(z.string()).optional(),
});

const lessonSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  pathId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  type: z.enum(["video", "quiz", "file", "assignment", "text", "live_youtube", "zoom", "google_meet", "teams"]),
  duration: z.string().default(""),
  content: z.string().optional(),
  videoUrl: z.string().optional(),
  videoSource: z.enum(["upload", "youtube", "vimeo"]).optional(),
  interactiveQuestions: z
    .array(
      z.object({
        id: z.string().min(1),
        timestamp: z.number().min(0),
        questionId: z.string().optional(),
        inlineQuestion: z
          .object({
            text: z.string().min(1),
            options: z.array(z.string()).min(2),
            correctOptionIndex: z.number().min(0),
          })
          .optional(),
        mustPass: z.boolean().default(false),
        actionOnFail: z.enum(["rewatch", "continue"]).default("continue"),
        rewatchTimestamp: z.number().min(0).optional(),
      }),
    )
    .default([]),
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

const sanitizeLessonPayload = <T extends { videoUrl?: string; meetingUrl?: string; recordingUrl?: string; fileUrl?: string }>(payload: T): T => ({
  ...payload,
  ...(payload.videoUrl !== undefined ? { videoUrl: sanitizeVideoUrl(payload.videoUrl) } : {}),
  ...(payload.meetingUrl !== undefined ? { meetingUrl: sanitizeVideoUrl(payload.meetingUrl) } : {}),
  ...(payload.recordingUrl !== undefined ? { recordingUrl: sanitizeVideoUrl(payload.recordingUrl) } : {}),
  ...(payload.fileUrl !== undefined ? { fileUrl: sanitizeVideoUrl(payload.fileUrl) } : {}),
});

const buildDocumentQuery = (value: string) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return { $or: [{ id: value }, { _id: value }] };
  }

  return { id: value };
};

const announcementAdSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  body: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
  ctaLabel: z.string().optional().default(""),
  ctaUrl: z.string().optional().default(""),
  audience: z.enum(["all", "guest", "student", "parent", "staff"]).default("all"),
  displayMode: z.enum(["modal", "top-banner"]).default("modal"),
  frequency: z.enum(["always", "session", "once"]).default("session"),
  imageFit: z.enum(["cover", "contain"]).default("cover"),
  delaySeconds: z.number().min(0).max(30).default(0),
  isActive: z.boolean().default(true),
  priority: z.number().default(0),
  startsAt: z.number().nullable().optional(),
  endsAt: z.number().nullable().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const announcementAdUpdateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  audience: z.enum(["all", "guest", "student", "parent", "staff"]).optional(),
  displayMode: z.enum(["modal", "top-banner"]).optional(),
  frequency: z.enum(["always", "session", "once"]).optional(),
  imageFit: z.enum(["cover", "contain"]).optional(),
  delaySeconds: z.number().min(0).max(30).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
  startsAt: z.number().nullable().optional(),
  endsAt: z.number().nullable().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const platformFontUploadSchema = z.object({
  name: z.string().max(80).optional().default(""),
  dataUrl: z
    .string()
    .max(700_000)
    .regex(/^data:font\/(woff2?|ttf|otf);base64,[A-Za-z0-9+/=]+$/)
    .optional()
    .or(z.literal("")),
  fileName: z.string().max(160).optional().default(""),
  mimeType: z.string().max(80).optional().default(""),
  size: z.number().min(0).max(500_000).optional().default(0),
});

const platformFontFamilySchema = z
  .enum([
    "tajawal",
    "cairo",
    "almarai",
    "readex-pro",
    "ibm-plex-sans-arabic",
    "noto-naskh-arabic",
    "noto-kufi-arabic",
    "system",
    "custom",
  ])
  .default("tajawal");
const platformFontSizeSchema = z.string().regex(/^\d{1,2}(\.\d)?(px|rem)$/).optional().or(z.literal(""));
const platformFontWeightSchema = z
  .enum(["300", "400", "500", "600", "700", "800", "900", "normal", "bold"])
  .optional()
  .or(z.literal(""));
const platformFontColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal(""));

const platformFontSettingsSchema = z.object({
  bodyFont: platformFontFamilySchema,
  headingFont: platformFontFamilySchema,
  navigationFont: platformFontFamilySchema,
  buttonFont: platformFontFamilySchema,
  bodySize: platformFontSizeSchema,
  headingSize: platformFontSizeSchema,
  navigationSize: platformFontSizeSchema,
  buttonSize: platformFontSizeSchema,
  bodyWeight: platformFontWeightSchema,
  headingWeight: platformFontWeightSchema,
  navigationWeight: platformFontWeightSchema,
  buttonWeight: platformFontWeightSchema,
  bodyColor: platformFontColorSchema,
  headingColor: platformFontColorSchema,
  navigationColor: platformFontColorSchema,
  buttonColor: platformFontColorSchema,
  bodyCustomFont: platformFontUploadSchema.optional(),
  headingCustomFont: platformFontUploadSchema.optional(),
});

const CONTENT_BOOTSTRAP_CACHE_TTL_MS = 3 * 60 * 1000;
const CONTENT_BOOTSTRAP_MINIMAL_CACHE_TTL_MS = 3 * 60 * 1000;
const PUBLIC_ANNOUNCEMENT_ADS_BOOTSTRAP_LIMIT = 8;
type PublicContentBootstrapPayload = {
  topics: unknown[];
  lessons: unknown[];
  libraryItems: unknown[];
  groups: unknown[];
  b2bPackages: unknown[];
  accessCodes: unknown[];
  announcementAds: unknown[];
  studyPlans: unknown[];
};
type ContentBootstrapCachePayload = PublicContentBootstrapPayload;
type ContentBootstrapCacheEntry = { expiresAt: number; payload: ContentBootstrapCachePayload };
const contentBootstrapScopeSchema = z.enum(["full", "learning"]).default("full");
const contentBootstrapPhaseSchema = z.enum(["full", "core"]).default("full");
let contentBootstrapCache = new Map<string, ContentBootstrapCacheEntry>();
let contentBootstrapPromises = new Map<string, Promise<ContentBootstrapCachePayload>>();
const publicContentBootstrapPromise = contentBootstrapPromises;
let contentBootstrapMinimalCache:
  | {
      expiresAt: number;
      payload: PublicContentBootstrapPayload;
    }
  | null = null;
let contentBootstrapMinimalPromise: Promise<PublicContentBootstrapPayload> | null = null;

const clearContentBootstrapCache = () => {
  contentBootstrapCache.clear();
  contentBootstrapPromises.clear();
  contentBootstrapMinimalCache = null;
  contentBootstrapMinimalPromise = null;
};

const scopeFilterToActivePaths = <T extends Record<string, unknown>>(baseFilter: T, activePathIds: string[], pathField = "pathId") => ({
  $and: [
    baseFilter,
    {
      $or: [
        { [pathField]: { $in: activePathIds } },
        { [pathField]: { $exists: false } },
        { [pathField]: "" },
        { [pathField]: null },
      ],
    },
  ],
});

const uniqueStrings = (values: Array<string | undefined | null>) =>
  [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];

const getModelDocumentId = (document: { id?: unknown; _id?: unknown }) => String(document.id || document._id || "");

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
    const [groups, b2bPackages, accessCodes, announcementAds] = await Promise.all([
      GroupModel.find().sort({ createdAt: -1 }),
      B2BPackageModel.find().sort({ createdAt: -1 }),
      AccessCodeModel.find().sort({ createdAt: -1 }),
      AnnouncementAdModel.find().sort({ priority: 1, createdAt: -1 }),
    ]);

    return { groups, b2bPackages, accessCodes, announcementAds };
  }

  if (!authUser) {
    const announcementAds = await AnnouncementAdModel.find({ isActive: true })
      .sort({ priority: 1, createdAt: -1 })
      .limit(PUBLIC_ANNOUNCEMENT_ADS_BOOTSTRAP_LIMIT)
      .lean();
    return { groups: [], b2bPackages: [], accessCodes: [], announcementAds };
  }

  const user = await UserModel.findById(authUser.id).select("schoolId groupIds linkedStudentIds role");
  if (!user) {
    const announcementAds = await AnnouncementAdModel.find({ isActive: true })
      .sort({ priority: 1, createdAt: -1 })
      .limit(PUBLIC_ANNOUNCEMENT_ADS_BOOTSTRAP_LIMIT);
    return { groups: [], b2bPackages: [], accessCodes: [], announcementAds };
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
    const announcementAds = await AnnouncementAdModel.find({ isActive: true })
      .sort({ priority: 1, createdAt: -1 })
      .limit(PUBLIC_ANNOUNCEMENT_ADS_BOOTSTRAP_LIMIT);
    return { groups: [], b2bPackages: [], accessCodes: [], announcementAds };
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
  const [b2bPackages, accessCodes, announcementAds] = await Promise.all([
    schoolIds.length ? B2BPackageModel.find({ schoolId: { $in: schoolIds } }).sort({ createdAt: -1 }) : Promise.resolve([]),
    user.role === "supervisor" && schoolIds.length
      ? AccessCodeModel.find({ schoolId: { $in: schoolIds } }).sort({ createdAt: -1 })
      : Promise.resolve([]),
    AnnouncementAdModel.find({ isActive: true })
      .sort({ priority: 1, createdAt: -1 })
      .limit(PUBLIC_ANNOUNCEMENT_ADS_BOOTSTRAP_LIMIT),
  ]);

  return { groups, b2bPackages, accessCodes, announcementAds };
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

const libraryUpdateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).optional(),
  size: z.string().optional(),
  downloads: z.number().optional(),
  type: z.enum(["pdf", "doc", "video"]).optional(),
  pathId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  sectionId: z.string().nullable().optional(),
  skillIds: z.array(z.string()).min(1).optional(),
  url: z.string().optional(),
  showOnPlatform: z.boolean().optional(),
  isLocked: z.boolean().optional(),
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
  assignedTeacherId: z.string().optional(),
  revenueSharePercentage: z.number().nullable().optional(),
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

const accessCodesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  search: z.string().trim().optional(),
  schoolId: z.string().trim().optional(),
  packageId: z.string().trim().optional(),
  status: z.enum(["active", "expired", "exhausted"]).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "expiresAt", "currentUses", "maxUses", "code"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const accessCodeRedemptionsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  accessCodeId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  schoolId: z.string().trim().optional(),
  status: z.enum(["active", "revoked", "expired"]).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sortBy: z.enum(["grantedAt", "expiresAt", "createdAt"]).default("grantedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDateToTimestamp = (value?: string) => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const buildPaginationMeta = (total: number, page: number, limit: number) => {
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

const normalizeAccessCodeResponse = (code: any) => ({
  id: String(code.id || code._id || ""),
  code: String(code.code || ""),
  schoolId: String(code.schoolId || ""),
  packageId: String(code.packageId || ""),
  maxUses: Number(code.maxUses || 0),
  currentUses: Number(code.currentUses || 0),
  expiresAt: Number(code.expiresAt || 0),
  createdAt: Number(code.createdAt || 0),
});

const resolveAccessCodeSchoolsForSupervisor = async (authUser: { id: string }) => {
  const user = await UserModel.findById(authUser.id).select("schoolId groupIds role").lean();
  if (!user) {
    return [] as string[];
  }

  const managedGroupIds = uniqueStrings([...(user.groupIds || []).map(String)]);
  const [seedGroups, directSupervisedSchools] = await Promise.all([
    managedGroupIds.length
      ? GroupModel.find(buildDocumentsByIdsQuery(managedGroupIds)).select("id _id parentId type")
      : Promise.resolve([]),
    GroupModel.find({ type: "SCHOOL", supervisorIds: authUser.id }).select("id _id"),
  ]);

  const schoolIds = uniqueStrings([
    String(user.schoolId || ""),
    ...directSupervisedSchools.map((group) => String(group.id || group._id)),
    ...seedGroups.filter((group) => group.type === "SCHOOL").map((group) => String(group.id || group._id)),
    ...seedGroups.filter((group) => group.type === "CLASS" || group.type === "PRIVATE_GROUP").map((group) => String(group.parentId || "")),
  ]);

  return uniqueStrings(schoolIds.filter(Boolean));
};

const assertSchoolManagementScope = async (
  authUser: { id: string; role: string },
  school: { id?: string; _id?: unknown; supervisorIds?: unknown[] },
) => {
  if (authUser.role === "admin") {
    return true;
  }

  const schoolId = String(school.id || school._id || "");
  if (!schoolId) {
    return false;
  }

  const scopedSchoolIds = await resolveAccessCodeSchoolsForSupervisor({ id: authUser.id });
  if (scopedSchoolIds.includes(schoolId)) {
    return true;
  }

  const supervisorIds = Array.isArray(school.supervisorIds) ? school.supervisorIds.map(String) : [];
  return supervisorIds.includes(String(authUser.id));
};

const hasTopicManagementScope = (
  authUser: { role: string; managedPathIds?: string[]; managedSubjectIds?: string[] },
  topic: { pathId?: unknown; subjectId?: unknown },
) => {
  if (authUser.role === "admin") {
    return true;
  }

  const topicPathId = String(topic.pathId || "");
  const topicSubjectId = String(topic.subjectId || "");
  const managedPathIds = Array.isArray(authUser.managedPathIds) ? authUser.managedPathIds.map(String) : [];
  const managedSubjectIds = Array.isArray(authUser.managedSubjectIds) ? authUser.managedSubjectIds.map(String) : [];

  return managedPathIds.includes(topicPathId) || managedSubjectIds.includes(topicSubjectId);
};

const hasGroupManagementScope = async (
  authUser: { id: string; role: string },
  group: { id?: string; _id?: unknown; type?: unknown; parentId?: unknown; ownerId?: unknown; supervisorIds?: unknown[] },
) => {
  if (authUser.role === "admin") {
    return true;
  }

  const groupId = String(group.id || group._id || "");
  const parentId = String(group.parentId || "");
  const ownerId = String(group.ownerId || "");
  const supervisorIds = Array.isArray(group.supervisorIds) ? group.supervisorIds.map(String) : [];

  if (ownerId && ownerId === String(authUser.id)) {
    return true;
  }

  if (supervisorIds.includes(String(authUser.id))) {
    return true;
  }

  if (authUser.role === "supervisor") {
    const scopedSchoolIds = await resolveAccessCodeSchoolsForSupervisor({ id: authUser.id });
    if (String(group.type || "") === "SCHOOL" && scopedSchoolIds.includes(groupId)) {
      return true;
    }
    if (scopedSchoolIds.includes(parentId)) {
      return true;
    }
  }

  return false;
};

const hasSchoolIdManagementScope = async (
  authUser: { id: string; role: string },
  schoolId: string,
) => {
  if (authUser.role === "admin") {
    return true;
  }

  const scopedSchoolIds = await resolveAccessCodeSchoolsForSupervisor({ id: authUser.id });
  return scopedSchoolIds.includes(String(schoolId || ""));
};

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

const schoolRelationRowSchema = z.object({
  studentEmail: z.string().email(),
  parentEmail: z.string().email().optional().or(z.literal("")),
  parentName: z.string().optional(),
  supervisorEmail: z.string().email().optional().or(z.literal("")),
  supervisorName: z.string().optional(),
  className: z.string().optional(),
});

const schoolRelationSchema = z.object({
  rows: z.array(schoolRelationRowSchema).min(1),
  createMissingUsers: z.boolean().default(true),
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
      imageAlt: z.string().optional(),
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
  typography: z
    .object({
      headingFont: z.enum(["tajawal", "system", "serif"]).optional(),
      bodyFont: z.enum(["tajawal", "system", "serif"]).optional(),
      headingWeight: z.enum(["bold", "black"]).optional(),
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
    imageUrl: "/images/homepage-hero-boy-platform.jpg?v=20260512",
    imageAlt: "طالب يستخدم منصة المئة",
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
  typography: {
    headingFont: "tajawal",
    bodyFont: "tajawal",
    headingWeight: "black",
  },
  featuredPathIds: [],
  featuredCourseIds: [],
  featuredArticleLessonIds: [],
};

const defaultPlatformFontSettings = {
  key: "default",
  bodyFont: "tajawal",
  headingFont: "tajawal",
  navigationFont: "tajawal",
  buttonFont: "tajawal",
  bodySize: "",
  headingSize: "",
  navigationSize: "",
  buttonSize: "",
  bodyWeight: "",
  headingWeight: "",
  navigationWeight: "",
  buttonWeight: "",
  bodyColor: "",
  headingColor: "",
  navigationColor: "",
  buttonColor: "",
  bodyCustomFont: {},
  headingCustomFont: {},
};

const providerSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.string().default("oauth"),
  appId: z.string().optional().default(""),
  appSecret: z.string().optional().default(""),
  clientId: z.string().optional().default(""),
  clientSecret: z.string().optional().default(""),
  apiKey: z.string().optional().default(""),
  accessToken: z.string().optional().default(""),
  callbackUrl: z.string().optional().default(""),
  fromEmail: z.string().optional().default(""),
  senderName: z.string().optional().default(""),
  botUsername: z.string().optional().default(""),
  botToken: z.string().optional().default(""),
  chatId: z.string().optional().default(""),
  phoneNumber: z.string().optional().default(""),
  phoneNumberId: z.string().optional().default(""),
  businessAccountId: z.string().optional().default(""),
  verifyToken: z.string().optional().default(""),
  webhookUrl: z.string().optional().default(""),
  note: z.string().optional().default(""),
});

const externalPlatformSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(false),
  platformType: z.enum(["lms", "marketplace", "crm", "custom"]).default("custom"),
  baseUrl: z.string().optional().default(""),
  apiKey: z.string().optional().default(""),
  apiSecret: z.string().optional().default(""),
  webhookUrl: z.string().optional().default(""),
  webhookSecret: z.string().optional().default(""),
  syncStudents: z.boolean().default(false),
  syncCourses: z.boolean().default(false),
  syncOrders: z.boolean().default(false),
  syncScheduleCron: z.string().optional().default(""),
  note: z.string().optional().default(""),
});

const seoSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  siteName: z.string().optional().default("منصة المئة"),
  defaultTitle: z.string().optional().default("منصة المئة | قدرات وتحصيلي"),
  defaultDescription: z.string().optional().default("منصة تعليمية ذكية للتدريب على القدرات والتحصيلي."),
  defaultKeywords: z.array(z.string()).default([]),
  canonicalBaseUrl: z.string().optional().default(""),
  defaultOgImage: z.string().optional().default(""),
  twitterHandle: z.string().optional().default(""),
  googleSiteVerification: z.string().optional().default(""),
  googleAnalyticsId: z.string().optional().default(""),
  googleTagManagerId: z.string().optional().default(""),
  robotsIndexingEnabled: z.boolean().default(true),
  noIndexPaths: z.array(z.string()).default(["/#/admin-dashboard", "/#/dashboard", "/#/login"]),
  organizationName: z.string().optional().default("منصة المئة"),
  organizationLogoUrl: z.string().optional().default(""),
  organizationUrl: z.string().optional().default(""),
});

const contactWidgetSchema = z.object({
  enabled: z.boolean().default(true),
  channel: z.enum(["whatsapp", "telegram", "phone"]).default("whatsapp"),
  whatsappNumber: z.string().optional().default(""),
  whatsappMessage: z.string().optional().default("مرحبًا، أريد الاستفسار عن منصة المئة."),
  openInNewTab: z.boolean().default(true),
  showOnPublicPages: z.boolean().default(true),
  showOnDashboardPages: z.boolean().default(false),
});

const platformIntegrationSettingsSchema = z.object({
  auth: z.object({
    allowSelfRegistration: z.boolean().default(true),
    allowEmailPassword: z.boolean().default(true),
    requireEmailVerification: z.boolean().default(false),
    requireAdminApproval: z.boolean().default(false),
    defaultRole: z.enum(["student", "parent"]).default("student"),
    registrationTitle: z.string().optional().default(""),
    registrationSubtitle: z.string().optional().default(""),
    termsLink: z.string().optional().default(""),
    privacyLink: z.string().optional().default(""),
    maxAccountsPerDevice: z.number().int().min(1).max(20).default(3),
    allowedEmailDomains: z.array(z.string()).default([]),
  }),
  providers: z.object({
    google: providerSettingsSchema.default({ enabled: false, mode: "oauth" }),
    facebook: providerSettingsSchema.default({ enabled: false, mode: "oauth" }),
    whatsapp: providerSettingsSchema.default({ enabled: false, mode: "otp" }),
    telegram: providerSettingsSchema.default({ enabled: false, mode: "bot" }),
    email: providerSettingsSchema.default({ enabled: false, mode: "smtp" }),
    sentry: providerSettingsSchema.default({ enabled: false, mode: "dsn" }),
    redis: providerSettingsSchema.default({ enabled: false, mode: "managed" }),
    zoom: providerSettingsSchema.default({ enabled: false, mode: "oauth" }),
    googleMeet: providerSettingsSchema.default({ enabled: false, mode: "oauth" }),
    teams: providerSettingsSchema.default({ enabled: false, mode: "oauth" }),
    youtubeLive: providerSettingsSchema.default({ enabled: false, mode: "api" }),
  }),
  seo: seoSettingsSchema.default({}),
  contactWidget: contactWidgetSchema.default({}),
  externalPlatforms: z.array(externalPlatformSchema).default([]),
  registrationFields: z
    .array(
      z.object({
        id: z.string().min(1),
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(["text", "email", "phone", "select", "textarea"]).default("text"),
        required: z.boolean().default(false),
        enabled: z.boolean().default(true),
        options: z.array(z.string()).default([]),
        placeholder: z.string().optional().default(""),
        helpText: z.string().optional().default(""),
        order: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
});

const providerSettingsPatchSchema = providerSettingsSchema.partial();

const platformIntegrationSettingsPatchSchema = z.object({
  auth: platformIntegrationSettingsSchema.shape.auth.partial().optional(),
  providers: z.object({
    google: providerSettingsPatchSchema.optional(),
    facebook: providerSettingsPatchSchema.optional(),
    whatsapp: providerSettingsPatchSchema.optional(),
    telegram: providerSettingsPatchSchema.optional(),
    email: providerSettingsPatchSchema.optional(),
    sentry: providerSettingsPatchSchema.optional(),
    redis: providerSettingsPatchSchema.optional(),
    zoom: providerSettingsPatchSchema.optional(),
    googleMeet: providerSettingsPatchSchema.optional(),
    teams: providerSettingsPatchSchema.optional(),
    youtubeLive: providerSettingsPatchSchema.optional(),
  }).partial().optional(),
  seo: seoSettingsSchema.partial().optional(),
  contactWidget: contactWidgetSchema.partial().optional(),
  externalPlatforms: z.array(externalPlatformSchema).optional(),
  registrationFields: platformIntegrationSettingsSchema.shape.registrationFields.optional(),
});

const defaultPlatformIntegrationSettings = {
  key: "default",
  auth: {
    allowSelfRegistration: true,
    allowEmailPassword: true,
    requireEmailVerification: false,
    requireAdminApproval: false,
    defaultRole: "student",
    registrationTitle: "ابدأ رحلتك التعليمية الآن",
    registrationSubtitle: "سجل حسابك واختر المسار المناسب لك.",
    termsLink: "",
    privacyLink: "",
    maxAccountsPerDevice: 3,
    allowedEmailDomains: [],
  },
  providers: {
    google: { enabled: false, mode: "oauth", clientId: "", callbackUrl: "", note: "" },
    facebook: { enabled: false, mode: "oauth", clientId: "", callbackUrl: "", note: "" },
    whatsapp: { enabled: false, mode: "otp", phoneNumberId: "", webhookUrl: "", note: "" },
    telegram: { enabled: false, mode: "bot", botUsername: "", webhookUrl: "", note: "" },
    email: { enabled: false, mode: "smtp", fromEmail: "", senderName: "", apiKey: "", webhookUrl: "", note: "" },
    sentry: { enabled: false, mode: "dsn", accessToken: "", note: "" },
    redis: { enabled: false, mode: "managed", callbackUrl: "", accessToken: "", note: "" },
    zoom: { enabled: false, mode: "oauth", clientId: "", clientSecret: "", callbackUrl: "", note: "" },
    googleMeet: { enabled: false, mode: "oauth", clientId: "", clientSecret: "", callbackUrl: "", note: "" },
    teams: { enabled: false, mode: "oauth", clientId: "", clientSecret: "", callbackUrl: "", note: "" },
    youtubeLive: { enabled: false, mode: "api", apiKey: "", callbackUrl: "", note: "" },
  },
  seo: {
    enabled: true,
    siteName: "منصة المئة",
    defaultTitle: "منصة المئة | قدرات وتحصيلي",
    defaultDescription: "منصة تعليمية ذكية للتدريب على القدرات والتحصيلي.",
    defaultKeywords: ["منصة المئة", "قدرات", "تحصيلي", "اختبارات", "تدريب"],
    canonicalBaseUrl: "",
    defaultOgImage: "",
    twitterHandle: "",
    googleSiteVerification: "",
    googleAnalyticsId: "",
    googleTagManagerId: "",
    robotsIndexingEnabled: true,
    noIndexPaths: ["/#/admin-dashboard", "/#/dashboard", "/#/login"],
    organizationName: "منصة المئة",
    organizationLogoUrl: "",
    organizationUrl: "",
  },
  contactWidget: {
    enabled: true,
    channel: "whatsapp",
    whatsappNumber: "",
    whatsappMessage: "مرحبًا، أريد الاستفسار عن منصة المئة.",
    openInNewTab: true,
    showOnPublicPages: true,
    showOnDashboardPages: false,
  },
  externalPlatforms: [
    {
      id: "eduoma",
      name: "Eduoma",
      enabled: false,
      platformType: "lms",
      baseUrl: "",
      apiKey: "",
      apiSecret: "",
      webhookUrl: "",
      webhookSecret: "",
      syncStudents: false,
      syncCourses: false,
      syncOrders: false,
      syncScheduleCron: "",
      note: "",
    },
  ],
  registrationFields: [
    { id: "full_name", key: "name", label: "الاسم الكامل", type: "text", required: true, enabled: true, options: [], placeholder: "", helpText: "", order: 0 },
    { id: "email", key: "email", label: "البريد الإلكتروني", type: "email", required: true, enabled: true, options: [], placeholder: "", helpText: "", order: 1 },
    { id: "phone", key: "phone", label: "رقم الجوال", type: "phone", required: false, enabled: true, options: [], placeholder: "", helpText: "", order: 2 },
  ],
};

const normalizeBaseUrl = (value?: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const buildPublicBaseUrl = (settings: { seo?: { canonicalBaseUrl?: string } } | null | undefined, reqHost?: string) => {
  const bySeo = normalizeBaseUrl(settings?.seo?.canonicalBaseUrl);
  if (bySeo) return bySeo;
  const byHost = normalizeBaseUrl(reqHost);
  if (byHost) return byHost;
  return "";
};

const SENSITIVE_PROVIDER_FIELDS = ["appSecret", "clientSecret", "apiKey", "accessToken", "botToken", "verifyToken"] as const;

const maskSensitiveProviderValues = (settings: Record<string, unknown>) => {
  const masked = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
  const providers = (masked.providers as Record<string, Record<string, unknown>> | undefined) || {};
  const providerSecretState: Record<string, Record<string, boolean>> = {};

  Object.entries(providers).forEach(([providerKey, providerConfig]) => {
    providerSecretState[providerKey] = {};
    SENSITIVE_PROVIDER_FIELDS.forEach((fieldKey) => {
      const currentValue = String(providerConfig[fieldKey] || "");
      providerSecretState[providerKey][fieldKey] = currentValue.length > 0;
      if (currentValue.length > 0) {
        providerConfig[fieldKey] = "";
      }
    });
  });

  masked.providerSecretState = providerSecretState;
  return masked;
};

const mergeSensitiveProviderValues = (
  payload: Record<string, unknown>,
  previous?: Record<string, unknown> | null,
) => {
  const merged = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const mergedProviders = (merged.providers as Record<string, Record<string, unknown>> | undefined) || {};
  const previousProviders = ((previous?.providers as Record<string, Record<string, unknown>> | undefined) || {});

  Object.entries(mergedProviders).forEach(([providerKey, providerConfig]) => {
    const previousConfig = previousProviders[providerKey] || {};
    SENSITIVE_PROVIDER_FIELDS.forEach((fieldKey) => {
      const incomingValue = String(providerConfig[fieldKey] || "").trim();
      const previousValue = String(previousConfig[fieldKey] || "");
      if (!incomingValue && previousValue) {
        providerConfig[fieldKey] = previousValue;
      }
    });
  });

  return merged;
};

const maskIntegrationSnapshot = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== "object") {
    return {};
  }

  const safeSnapshot = maskSensitiveProviderValues(JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>);
  return safeSnapshot;
};

export const contentRouter = Router();

contentRouter.use((req, _res, next) => {
  if (req.method !== "GET") {
    clearContentBootstrapCache();
  }
  next();
});

contentRouter.get(
  "/homepage-settings",
  optionalAuth,
  asyncHandler(async (_req, res) => {
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
    const settings = await HomepageSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: payload, $setOnInsert: { key: "default" } },
      { new: true, upsert: true },
    );

    return res.json(settings);
  }),
);

contentRouter.get(
  "/platform-font-settings",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    let settings = await PlatformFontSettingsModel.findOne({ key: "default" });
    if (!settings) {
      settings = await PlatformFontSettingsModel.create(defaultPlatformFontSettings);
    }

    return res.json(settings);
  }),
);

contentRouter.patch(
  "/platform-font-settings",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = platformFontSettingsSchema.parse(req.body);
    const settings = await PlatformFontSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: payload, $setOnInsert: { key: "default" } },
      { new: true, upsert: true },
    );

    return res.json(settings);
  }),
);

contentRouter.get(
  "/bootstrap/minimal",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    if (contentBootstrapMinimalCache && contentBootstrapMinimalCache.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=180");
      res.setHeader("X-Content-Minimal-Cache", "hit");
      return res.json(contentBootstrapMinimalCache.payload);
    }

    if (contentBootstrapMinimalPromise) {
      const payload = await contentBootstrapMinimalPromise;
      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=180");
      res.setHeader("X-Content-Minimal-Cache", "shared");
      return res.json(payload);
    }

    const loadMinimalPayload = async (): Promise<PublicContentBootstrapPayload> => {
      const announcementAds = await AnnouncementAdModel.find({ isActive: true, audience: { $in: ["all", "guest"] } })
        .sort({ priority: -1, createdAt: -1 })
        .limit(PUBLIC_ANNOUNCEMENT_ADS_BOOTSTRAP_LIMIT)
        .lean();

      return {
        topics: [],
        lessons: [],
        libraryItems: [],
        groups: [],
        b2bPackages: [],
        accessCodes: [],
        announcementAds,
        studyPlans: [],
      };
    };

    const payload = await (contentBootstrapMinimalPromise = loadMinimalPayload().finally(() => {
      contentBootstrapMinimalPromise = null;
    }));
    contentBootstrapMinimalCache = {
      expiresAt: Date.now() + CONTENT_BOOTSTRAP_MINIMAL_CACHE_TTL_MS,
      payload,
    };
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=180");
    res.setHeader("X-Content-Minimal-Cache", "miss");
    return res.json(payload);
  }),
);

contentRouter.get(
  "/bootstrap",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const requestedScope = contentBootstrapScopeSchema.parse(req.query.scope);
    const requestedPhase = contentBootstrapPhaseSchema.parse(req.query.phase);
    const canUseFullScope = isStaffRole(req.authUser?.role);
    const scope = requestedScope === "full" && !canUseFullScope ? "learning" : requestedScope;
    const phase = scope === "learning" ? requestedPhase : "full";
    const isLearningCore = scope === "learning" && phase === "core";
    const includeOperationalData = scope !== "learning";
    const includeStudyPlans = scope !== "learning" && phase === "full";
    const isNonStaffAuthedLearning = Boolean(req.authUser) && !canUseFullScope && scope === "learning";
    const canUseSharedCache = !req.authUser || isNonStaffAuthedLearning;
    const cacheKey = canUseSharedCache ? `scope:${scope}:phase:${phase}:shared-learning` : "";
    const cachedEntry = cacheKey ? contentBootstrapCache.get(cacheKey) : null;
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", req.authUser ? "private, max-age=120" : "public, max-age=120, stale-while-revalidate=180");
      res.setHeader("X-Content-Cache", "hit");
      res.setHeader("X-Content-Scope", scope);
      res.setHeader("X-Content-Phase", phase);
      return res.json(cachedEntry.payload);
    }

    const pendingPromise = cacheKey ? contentBootstrapPromises.get(cacheKey) : null;
    if (pendingPromise) {
      const payload = await pendingPromise;
      res.setHeader("Cache-Control", req.authUser ? "private, max-age=120" : "public, max-age=120, stale-while-revalidate=180");
      res.setHeader("X-Content-Cache", "shared");
      res.setHeader("X-Content-Scope", scope);
      res.setHeader("X-Content-Phase", phase);
      return res.json(payload);
    }

    const loadBootstrapPayload = async (): Promise<PublicContentBootstrapPayload> => {
      const canSeeAllContent = isStaffRole(req.authUser?.role);
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
      const activePathIds = canSeeAllContent ? [] : await getActivePathIds();
      const finalTopicFilter = canSeeAllContent ? topicFilter : scopeFilterToActivePaths(topicFilter, activePathIds);
      const finalLessonFilter = canSeeAllContent ? lessonFilter : scopeFilterToActivePaths(lessonFilter, activePathIds);
      const finalLibraryFilter = canSeeAllContent ? libraryFilter : scopeFilterToActivePaths(libraryFilter, activePathIds);

      const [topics, lessons, libraryItems, operationalData, studyPlans] = await Promise.all([
        TopicModel.find(finalTopicFilter).sort({ subjectId: 1, order: 1 }).lean(),
        isLearningCore ? Promise.resolve([]) : LessonModel.find(finalLessonFilter).sort({ createdAt: -1 }).lean(),
        isLearningCore ? Promise.resolve([]) : LibraryItemModel.find(finalLibraryFilter).sort({ createdAt: -1 }).lean(),
        includeOperationalData
          ? getScopedOperationalData(req.authUser)
          : Promise.resolve({ groups: [], b2bPackages: [], accessCodes: [], announcementAds: [] }),
        includeStudyPlans && req.authUser
          ? StudyPlanModel.find({ userId: req.authUser.id }).sort({ updatedAt: -1 }).lean()
          : Promise.resolve([]),
      ]);

      const { groups, b2bPackages, accessCodes, announcementAds } = operationalData;
      return { topics, lessons, libraryItems, groups, b2bPackages, accessCodes, announcementAds, studyPlans };
    };

    const payloadPromise = loadBootstrapPayload();
    const payload = canUseSharedCache
      ? await (() => {
          if (!cacheKey) return payloadPromise;
          const inflight = payloadPromise.finally(() => {
            contentBootstrapPromises.delete(cacheKey);
          });
          contentBootstrapPromises.set(cacheKey, inflight);
          return inflight;
        })()
      : await payloadPromise;

    if (canUseSharedCache && cacheKey) {
      contentBootstrapCache.set(cacheKey, {
        expiresAt: Date.now() + CONTENT_BOOTSTRAP_CACHE_TTL_MS,
        payload,
      });
      res.setHeader("Cache-Control", req.authUser ? "private, max-age=120" : "public, max-age=120, stale-while-revalidate=180");
      res.setHeader("X-Content-Cache", "miss");
    }
    res.setHeader("X-Content-Scope", scope);
    res.setHeader("X-Content-Phase", phase);
    res.json(payload);
  }),
);

contentRouter.post(
  "/study-plans",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = studyPlanSchema.parse(req.body);
    const now = Date.now();
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
    const created = await TopicModel.create(payload);
    res.status(StatusCodes.CREATED).json(created);
  }),
);

contentRouter.patch(
  "/topics/:id",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = topicUpdateSchema.parse(req.body);
    const existing = await TopicModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Topic not found" });
    }

    const canManageTopic = hasTopicManagementScope(req.authUser!, existing as any);
    if (!canManageTopic) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You do not have access to this topic" });
    }

    const updated = await TopicModel.findOneAndUpdate(buildDocumentQuery(String(existing._id)), payload, {
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
    const existing = await TopicModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Topic not found" });
    }

    const canManageTopic = hasTopicManagementScope(req.authUser!, existing as any);
    if (!canManageTopic) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You do not have access to this topic" });
    }

    const deleted = await TopicModel.findOneAndDelete(buildDocumentQuery(String(existing._id)));

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
    const payload = sanitizeLessonPayload(lessonSchema.parse(req.body));
    const workflowDefaults = getWorkflowDefaults(req.authUser!);
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
    const payload = sanitizeLessonPayload(lessonSchema.partial().parse(req.body));
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
    const deleted = await LessonModel.findOneAndDelete(buildOwnedDocumentQuery(req.params.id, req.authUser!));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found" });
    }

    const deletedIds = [deleted.id, deleted._id, req.params.id].map((value) => String(value || "")).filter(Boolean);
    await TopicModel.updateMany({ lessonIds: { $in: deletedIds } }, { $pull: { lessonIds: { $in: deletedIds } } });

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
    const payload = libraryUpdateSchema.parse(req.body);
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
    const deleted = await LibraryItemModel.findOneAndDelete(buildOwnedDocumentQuery(req.params.id, req.authUser!));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Library item not found" });
    }

    const deletedIds = [deleted.id, deleted._id, req.params.id].map((value) => String(value || "")).filter(Boolean);
    await TopicModel.updateMany({ libraryItemIds: { $in: deletedIds } }, { $pull: { libraryItemIds: { $in: deletedIds } } });

    return res.json({ success: true });
  }),
);

contentRouter.post(
  "/groups",
  requireAuth,
  requireRole(["admin", "teacher", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = groupSchema.parse(req.body);
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
    const existing = await GroupModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Group not found" });
    }

    const canManageGroup = await hasGroupManagementScope(req.authUser!, existing as any);
    if (!canManageGroup) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this group" });
    }

    const updated = await GroupModel.findOneAndUpdate(buildDocumentQuery(String(existing._id)), payload, {
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
    const existing = await GroupModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Group not found" });
    }

    const canManageGroup = await hasGroupManagementScope(req.authUser!, existing as any);
    if (!canManageGroup) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this group" });
    }

    const deleted = await GroupModel.findOneAndDelete(buildDocumentQuery(String(existing._id)));

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
    if (req.authUser?.role === "supervisor") {
      const canManageSchool = await hasSchoolIdManagementScope(req.authUser, String(payload.schoolId || ""));
      if (!canManageSchool) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
      }
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
    const existing = await B2BPackageModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Package not found" });
    }

    if (req.authUser?.role === "supervisor") {
      const canManageSchool = await hasSchoolIdManagementScope(req.authUser, String(existing.schoolId || ""));
      if (!canManageSchool) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
      }
    }

    const updated = await B2BPackageModel.findOneAndUpdate(buildDocumentQuery(String(existing._id)), payload, {
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
    const existing = await B2BPackageModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Package not found" });
    }

    if (req.authUser?.role === "supervisor") {
      const canManageSchool = await hasSchoolIdManagementScope(req.authUser, String(existing.schoolId || ""));
      if (!canManageSchool) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
      }
    }

    const deleted = await B2BPackageModel.findOneAndDelete(buildDocumentQuery(String(existing._id)));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Package not found" });
    }

    await AccessCodeModel.deleteMany({ packageId: deleted.id || String(deleted._id) });
    return res.json({ success: true });
  }),
);

contentRouter.get(
  "/announcement-ads",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    const announcementAds = await AnnouncementAdModel.find({
      isActive: { $ne: false },
      $and: [
        { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .select("title body imageUrl ctaLabel ctaUrl audience displayMode frequency imageFit delaySeconds isActive startsAt endsAt priority createdAt updatedAt")
      .sort({ priority: 1, createdAt: -1 })
      .limit(8);

    return res.json({ announcementAds });
  }),
);

contentRouter.post(
  "/announcement-ads",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = announcementAdSchema.parse(req.body);
    const created = await AnnouncementAdModel.create({
      ...payload,
      createdAt: payload.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

contentRouter.patch(
  "/announcement-ads/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = announcementAdUpdateSchema.parse(req.body);
    const updated = await AnnouncementAdModel.findOneAndUpdate(
      buildDocumentQuery(req.params.id),
      { ...payload, updatedAt: Date.now() },
      { new: true },
    );

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Announcement ad not found" });
    }

    return res.json(updated);
  }),
);

contentRouter.delete(
  "/announcement-ads/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const deleted = await AnnouncementAdModel.findOneAndDelete(buildDocumentQuery(req.params.id));

    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Announcement ad not found" });
    }

    return res.json({ success: true });
  }),
);

contentRouter.post(
  "/access-codes",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = accessCodeSchema.parse(req.body);
    if (req.authUser?.role === "supervisor") {
      const canManageSchool = await hasSchoolIdManagementScope(req.authUser, String(payload.schoolId || ""));
      if (!canManageSchool) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
      }
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
    const existing = await AccessCodeModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Access code not found" });
    }

    if (req.authUser?.role === "supervisor") {
      const canManageSchool = await hasSchoolIdManagementScope(req.authUser, String(existing.schoolId || ""));
      if (!canManageSchool) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
      }
    }

    const updated = await AccessCodeModel.findOneAndUpdate(buildDocumentQuery(String(existing._id)), payload, {
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
    const existing = await AccessCodeModel.findOne(buildDocumentQuery(req.params.id));
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Access code not found" });
    }

    if (req.authUser?.role === "supervisor") {
      const canManageSchool = await hasSchoolIdManagementScope(req.authUser, String(existing.schoolId || ""));
      if (!canManageSchool) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
      }
    }

    const deleted = await AccessCodeModel.findOneAndDelete(buildDocumentQuery(String(existing._id)));

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
    const pagination = resolvePagination(req.query, { limit: 200 });
    const school = await GroupModel.findOne({
      ...buildDocumentQuery(req.params.id),
      type: "SCHOOL",
    });

    if (!school) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "School not found" });
    }

    const canManageSchool = await assertSchoolManagementScope(req.authUser!, school as any);
    if (!canManageSchool) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
    }

    const schoolId = school.id || String(school._id);

    const [classes, packages, codes, students, totalStudents, activeStudents] = await Promise.all([
      GroupModel.find({ type: "CLASS", parentId: schoolId }).sort({ createdAt: -1 }).lean(),
      B2BPackageModel.find({ schoolId }).sort({ createdAt: -1 }).lean(),
      AccessCodeModel.find({ schoolId }).sort({ createdAt: -1 }).lean(),
      UserModel.find({ schoolId }).select("id _id groupIds isActive").sort({ createdAt: -1 }).lean(),
      UserModel.countDocuments({ schoolId }),
      UserModel.countDocuments({ schoolId, isActive: { $ne: false } }),
    ]);

    const studentIds = students.map(getModelDocumentId).filter(Boolean);
    const [quizResults, quizResultTotal] = studentIds.length
      ? await Promise.all([
          QuizResultModel.find({ userId: { $in: studentIds } })
            .select("userId score skillsAnalysis createdAt")
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .lean(),
          QuizResultModel.countDocuments({ userId: { $in: studentIds } }),
        ])
      : [[], 0];

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
      const classId = getModelDocumentId(group);
      const classStudents = students.filter((student) => (student.groupIds || []).includes(classId));
      const classStudentIds = new Set(classStudents.map(getModelDocumentId).filter(Boolean));
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
        totalStudents,
        activeStudents,
        totalClasses: classes.length,
        activePackages: packages.filter((pkg) => pkg.status === "active").length,
        activeCodes: codes.filter((code) => Number(code.expiresAt) > Date.now()).length,
        quizAttempts: quizResultTotal,
        sampledQuizAttempts: quizResults.length,
        averageScore,
      },
      classSummaries,
      weakestSkills,
      quizResultsPagination: buildPaginatedResponse([], pagination, quizResultTotal),
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

    const canManageSchool = await assertSchoolManagementScope(req.authUser!, school as any);
    if (!canManageSchool) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
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

    return res.status(StatusCodes.CREATED).json({
      summary: {
        totalRows: payload.rows.length,
        imported: credentials.length,
        classesTouched: Array.from(
          new Set(credentials.map((item) => item.className).filter(Boolean)),
        ).length,
      },
      credentials,
    });
  }),
);

contentRouter.get(
  "/platform-integrations",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    let settings = await PlatformIntegrationSettingsModel.findOne({ key: "default" });
    if (!settings) {
      settings = await PlatformIntegrationSettingsModel.create(defaultPlatformIntegrationSettings);
    }

    const runtimeSettings = decryptIntegrationSecretsForRuntime((settings.toJSON ? settings.toJSON() : settings) as Record<string, unknown>);
    const safeSettings = maskSensitiveProviderValues(runtimeSettings);
    return res.json(safeSettings);
  }),
);

contentRouter.get(
  "/access-codes",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const query = accessCodesListQuerySchema.parse(req.query);
    const safePage = Math.max(1, Number(query.page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const pagination = resolvePagination({ page: safePage, limit: safeLimit }, { page: safePage, limit: safeLimit });
    const authUser = req.authUser!;
    const filter: Record<string, unknown> = {};
    let scopedSchoolIds: string[] | null = null;

    if (authUser.role === "supervisor") {
      scopedSchoolIds = await resolveAccessCodeSchoolsForSupervisor({ id: authUser.id });
      if (query.schoolId && !scopedSchoolIds.includes(query.schoolId)) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "School scope denied" });
      }
      filter.schoolId = query.schoolId ? query.schoolId : { $in: scopedSchoolIds };
    } else if (query.schoolId) {
      filter.schoolId = query.schoolId;
    }

    if (query.packageId) {
      filter.packageId = query.packageId;
    }

    if (query.search) {
      filter.code = { $regex: escapeRegExp(query.search), $options: "i" };
    }

    const createdAtFilter: Record<string, number> = {};
    const dateFrom = parseDateToTimestamp(query.dateFrom);
    const dateTo = parseDateToTimestamp(query.dateTo);
    if (dateFrom !== null) {
      createdAtFilter.$gte = dateFrom;
    }
    if (dateTo !== null) {
      createdAtFilter.$lte = dateTo;
    }
    if (Object.keys(createdAtFilter).length > 0) {
      filter.createdAt = createdAtFilter;
    }

    const now = Date.now();
    if (query.status === "active") {
      filter.$expr = {
        $and: [
          { $gt: ["$expiresAt", now] },
          { $lt: ["$currentUses", "$maxUses"] },
        ],
      };
    } else if (query.status === "expired") {
      filter.expiresAt = { $lte: now };
    } else if (query.status === "exhausted") {
      filter.$expr = { $gte: ["$currentUses", "$maxUses"] };
    }

    const direction = query.sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [query.sortBy]: direction };
    if (query.sortBy !== "createdAt") {
      sort.createdAt = -1;
    }

    const [codes, total] = await Promise.all([
      AccessCodeModel.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      AccessCodeModel.countDocuments(filter),
    ]);

    return res.json({
      data: codes.map(normalizeAccessCodeResponse),
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    });
  }),
);

contentRouter.get(
  "/access-code-redemptions",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const query = accessCodeRedemptionsListQuerySchema.parse(req.query);
    const safePage = Math.max(1, Number(query.page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const pagination = resolvePagination({ page: safePage, limit: safeLimit }, { page: safePage, limit: safeLimit });
    const authUser = req.authUser!;
    const grantFilter: Record<string, unknown> = { sourceType: "access_code" };
    const accessCodeFilter: Record<string, unknown> = {};
    let shouldResolveScopedCodes = false;
    let scopedSchoolIds: string[] | null = null;

    if (authUser.role === "supervisor") {
      scopedSchoolIds = await resolveAccessCodeSchoolsForSupervisor({ id: authUser.id });
      if (query.schoolId && !scopedSchoolIds.includes(query.schoolId)) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: "School scope denied" });
      }
      accessCodeFilter.schoolId = query.schoolId ? query.schoolId : { $in: scopedSchoolIds };
      shouldResolveScopedCodes = true;
    } else if (query.schoolId) {
      accessCodeFilter.schoolId = query.schoolId;
      shouldResolveScopedCodes = true;
    }

    if (query.accessCodeId) {
      accessCodeFilter.$or = [
        { id: query.accessCodeId },
        { _id: mongoose.Types.ObjectId.isValid(query.accessCodeId) ? new mongoose.Types.ObjectId(query.accessCodeId) : null },
      ].filter((entry) => entry._id !== null) as Array<Record<string, unknown>>;
      if (!accessCodeFilter.$or || (accessCodeFilter.$or as unknown[]).length === 0) {
        accessCodeFilter.$or = [{ id: query.accessCodeId }];
      }
      shouldResolveScopedCodes = true;
    }

    if (query.userId) {
      grantFilter.userId = query.userId;
    }
    if (query.status) {
      grantFilter.status = query.status;
    }

    const grantedAtFilter: Record<string, number> = {};
    const dateFrom = parseDateToTimestamp(query.dateFrom);
    const dateTo = parseDateToTimestamp(query.dateTo);
    if (dateFrom !== null) {
      grantedAtFilter.$gte = dateFrom;
    }
    if (dateTo !== null) {
      grantedAtFilter.$lte = dateTo;
    }
    if (Object.keys(grantedAtFilter).length > 0) {
      grantFilter.grantedAt = grantedAtFilter;
    }

    if (shouldResolveScopedCodes) {
      const scopedCodes = await AccessCodeModel.find(accessCodeFilter).select("id _id schoolId packageId code").lean();
      const scopedAccessCodeIds = scopedCodes.map((code) => String(code._id));
      if (scopedAccessCodeIds.length === 0) {
        return res.json({
          data: [],
          pagination: buildPaginationMeta(0, pagination.page, pagination.limit),
        });
      }
      grantFilter["metadata.accessCodeId"] = { $in: scopedAccessCodeIds };
    }

    const direction = query.sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [query.sortBy]: direction };
    if (query.sortBy !== "grantedAt") {
      sort.grantedAt = -1;
    }

    const [grants, total] = await Promise.all([
      AccessGrantModel.find(grantFilter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      AccessGrantModel.countDocuments(grantFilter),
    ]);

    const accessCodeIds = Array.from(
      new Set(
        grants
          .map((grant) => String((grant as any)?.metadata?.accessCodeId || ""))
          .filter(Boolean),
      ),
    );
    const userIds = Array.from(new Set(grants.map((grant) => String((grant as any)?.userId || "")).filter(Boolean)));

    const [codes, users] = await Promise.all([
      accessCodeIds.length
        ? AccessCodeModel.find({ _id: { $in: accessCodeIds } }).select("id _id code schoolId packageId").lean()
        : Promise.resolve([]),
      userIds.length ? UserModel.find(buildDocumentsByIdsQuery(userIds)).select("id _id name email").lean() : Promise.resolve([]),
    ]);

    const codeById = new Map(codes.map((code) => [String(code._id), code]));
    const userById = new Map(users.map((user) => [String((user as any).id || user._id), user]));

    return res.json({
      data: grants.map((grant: any) => {
        const accessCodeId = String(grant?.metadata?.accessCodeId || "");
        const code = codeById.get(accessCodeId);
        const userItem = userById.get(String(grant.userId || ""));
        return {
          id: String(grant.id || grant._id || ""),
          userId: String(grant.userId || ""),
          userName: String(userItem?.name || ""),
          userEmail: String(userItem?.email || ""),
          accessCodeId,
          accessCode: String(code?.code || grant?.metadata?.accessCode || ""),
          schoolId: String(code?.schoolId || ""),
          packageId: String(code?.packageId || grant.packageId || ""),
          status: String(grant.status || ""),
          grantedBy: String(grant.grantedBy || ""),
          grantedAt: Number(grant.grantedAt || 0),
          expiresAt: typeof grant.expiresAt === "number" ? grant.expiresAt : null,
        };
      }),
      pagination: buildPaginationMeta(total, pagination.page, pagination.limit),
    });
  }),
);

contentRouter.get(
  "/public-contact-widget",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const settings = await PlatformIntegrationSettingsModel.findOne({ key: "default" }).lean();
    const fallback = {
      enabled: false,
      channel: "whatsapp",
      whatsappNumber: "",
      whatsappMessage: "",
      openInNewTab: true,
      showOnPublicPages: true,
      showOnDashboardPages: false,
    };
    const widget = (settings?.contactWidget as Record<string, unknown> | undefined) || fallback;
    const safeWidget = {
      enabled: Boolean(widget.enabled),
      channel: (String(widget.channel || "whatsapp") as "whatsapp" | "telegram" | "phone"),
      whatsappNumber: String(widget.whatsappNumber || "").replace(/[^\d+]/g, ""),
      whatsappMessage: String(widget.whatsappMessage || ""),
      openInNewTab: widget.openInNewTab !== false,
      showOnPublicPages: widget.showOnPublicPages !== false,
      showOnDashboardPages: widget.showOnDashboardPages === true,
    };
    return res.json(safeWidget);
  }),
);

contentRouter.patch(
  "/platform-integrations",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const partialPayload = platformIntegrationSettingsPatchSchema.parse(req.body);
    const previous = await PlatformIntegrationSettingsModel.findOne({ key: "default" }).lean();
    const decryptedPrevious = previous
      ? decryptIntegrationSecretsForRuntime(previous as unknown as Record<string, unknown>)
      : null;
    const baseSettings = (decryptedPrevious || defaultPlatformIntegrationSettings) as Record<string, any>;

    const nextPayload = {
      ...baseSettings,
      ...partialPayload,
      auth: {
        ...(baseSettings.auth || {}),
        ...(partialPayload.auth || {}),
      },
      providers: (() => {
        const baseProviders = (baseSettings.providers || {}) as Record<string, Record<string, unknown>>;
        const incomingProviders = (partialPayload.providers || {}) as Record<string, Record<string, unknown>>;
        const mergedProviders: Record<string, Record<string, unknown>> = { ...baseProviders };
        Object.entries(incomingProviders).forEach(([providerKey, providerPatch]) => {
          mergedProviders[providerKey] = {
            ...(baseProviders[providerKey] || {}),
            ...(providerPatch || {}),
          };
        });
        return mergedProviders;
      })(),
      seo: {
        ...(baseSettings.seo || {}),
        ...(partialPayload.seo || {}),
      },
      contactWidget: {
        ...(baseSettings.contactWidget || {}),
        ...(partialPayload.contactWidget || {}),
      },
      externalPlatforms: partialPayload.externalPlatforms ?? baseSettings.externalPlatforms ?? [],
      registrationFields: partialPayload.registrationFields ?? baseSettings.registrationFields ?? [],
    };

    const payload = platformIntegrationSettingsSchema.parse(nextPayload);

    if (previous) {
      await PlatformIntegrationHistoryModel.create({
        settingsKey: "default",
        snapshot: previous,
        updatedBy: req.authUser?.id || "",
        note: "auto-backup before update",
      });
    }
    const mergedPayload = mergeSensitiveProviderValues(
      payload as unknown as Record<string, unknown>,
      decryptedPrevious as Record<string, unknown> | null,
    );
    const encryptedPayload = encryptIntegrationSecretsAtRest(mergedPayload);
    const settings = await PlatformIntegrationSettingsModel.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          ...encryptedPayload,
          updatedBy: req.authUser?.id || "",
        },
        $setOnInsert: { key: "default" },
      },
      { new: true, upsert: true },
    );

    const runtimeSettings = decryptIntegrationSecretsForRuntime((settings?.toJSON ? settings.toJSON() : settings) as Record<string, unknown>);
    const safeSettings = maskSensitiveProviderValues(runtimeSettings);
    return res.json(safeSettings);
  }),
);

contentRouter.get(
  "/platform-integrations/history",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    const history = await PlatformIntegrationHistoryModel.find({ settingsKey: "default" })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const safeHistory = history.map((item) => {
      const maskedSnapshot = maskIntegrationSnapshot((item as { snapshot?: unknown }).snapshot).providerSecretState;
      return {
        _id: String(item._id),
        updatedBy: String(item.updatedBy || ""),
        note: String(item.note || ""),
        createdAt: item.createdAt || null,
        providerSecretState: maskedSnapshot,
      };
    });
    return res.json({ history: safeHistory });
  }),
);

contentRouter.get(
  "/platform-integrations/setup-checklist",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const settings = await PlatformIntegrationSettingsModel.findOne({ key: "default" }).lean();
    const runtimeSettings = settings
      ? decryptIntegrationSecretsForRuntime(settings as unknown as Record<string, unknown>)
      : null;
    const publicBaseUrl = buildPublicBaseUrl(
      runtimeSettings as { seo?: { canonicalBaseUrl?: string } } | null,
      `${req.protocol}://${req.get("host") || ""}`,
    );
    const apiBaseUrl = `${normalizeBaseUrl(publicBaseUrl)}/api`;

    const providers = (runtimeSettings?.providers as Record<string, Record<string, unknown>> | undefined) || {};

    const checks = [
      {
        id: "google",
        title: "Google OAuth",
        envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        callbackUrl: `${apiBaseUrl}/auth/google/callback`,
        webhookUrl: "",
        enabled: Boolean(providers.google?.enabled),
        isConfigured: Boolean(providers.google?.clientId && providers.google?.clientSecret),
        notes: "تأكد من إضافة نفس Callback في Google Cloud.",
      },
      {
        id: "facebook",
        title: "Facebook OAuth",
        envKeys: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
        callbackUrl: `${apiBaseUrl}/auth/facebook/callback`,
        webhookUrl: "",
        enabled: Boolean(providers.facebook?.enabled),
        isConfigured: Boolean(providers.facebook?.clientId && providers.facebook?.clientSecret),
        notes: "أضف domain المنصة داخل App Domains في Meta.",
      },
      {
        id: "whatsapp",
        title: "WhatsApp Cloud",
        envKeys: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"],
        callbackUrl: "",
        webhookUrl: `${apiBaseUrl}/webhooks/whatsapp`,
        enabled: Boolean(providers.whatsapp?.enabled),
        isConfigured: Boolean(providers.whatsapp?.accessToken && providers.whatsapp?.phoneNumberId && providers.whatsapp?.verifyToken),
        notes: "Webhook verification token لازم يطابق الإعداد داخل Meta.",
      },
      {
        id: "email",
        title: "Email Provider",
        envKeys: ["EMAIL_PROVIDER", "EMAIL_API_KEY", "EMAIL_FROM"],
        callbackUrl: "",
        webhookUrl: "",
        enabled: Boolean(providers.email?.enabled),
        isConfigured: Boolean(providers.email?.apiKey && providers.email?.fromEmail),
        notes: "يفضل Resend أو SendGrid مع domain موثق.",
      },
      {
        id: "sentry",
        title: "Sentry",
        envKeys: ["SENTRY_DSN"],
        callbackUrl: "",
        webhookUrl: "",
        enabled: Boolean(providers.sentry?.enabled),
        isConfigured: Boolean(providers.sentry?.accessToken),
        notes: "أضف DSN في السيرفر والواجهة إذا مطلوب.",
      },
      {
        id: "redis",
        title: "Redis Managed",
        envKeys: ["REDIS_URL"],
        callbackUrl: "",
        webhookUrl: "",
        enabled: Boolean(providers.redis?.enabled),
        isConfigured: Boolean(providers.redis?.accessToken),
        notes: "مطلوب للتوسع: Rate Limit + Queue + Socket adapter.",
      },
      {
        id: "zoom",
        title: "Zoom",
        envKeys: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"],
        callbackUrl: `${apiBaseUrl}/auth/zoom/callback`,
        webhookUrl: "",
        enabled: Boolean(providers.zoom?.enabled),
        isConfigured: Boolean(providers.zoom?.clientId && providers.zoom?.clientSecret),
        notes: "OAuth app من Zoom Marketplace.",
      },
      {
        id: "googleMeet",
        title: "Google Meet",
        envKeys: ["GOOGLE_MEET_CLIENT_ID", "GOOGLE_MEET_CLIENT_SECRET"],
        callbackUrl: `${apiBaseUrl}/auth/google-meet/callback`,
        webhookUrl: "",
        enabled: Boolean(providers.googleMeet?.enabled),
        isConfigured: Boolean(providers.googleMeet?.clientId && providers.googleMeet?.clientSecret),
        notes: "فعّل Google Calendar API للإنشاء.",
      },
      {
        id: "teams",
        title: "Microsoft Teams",
        envKeys: ["TEAMS_CLIENT_ID", "TEAMS_CLIENT_SECRET", "TEAMS_TENANT_ID"],
        callbackUrl: `${apiBaseUrl}/auth/teams/callback`,
        webhookUrl: "",
        enabled: Boolean(providers.teams?.enabled),
        isConfigured: Boolean(providers.teams?.clientId && providers.teams?.clientSecret),
        notes: "تأكد من صلاحيات Microsoft Graph اللازمة.",
      },
      {
        id: "youtubeLive",
        title: "YouTube Live",
        envKeys: ["YOUTUBE_API_KEY"],
        callbackUrl: `${apiBaseUrl}/auth/youtube/callback`,
        webhookUrl: "",
        enabled: Boolean(providers.youtubeLive?.enabled),
        isConfigured: Boolean(providers.youtubeLive?.apiKey),
        notes: "فعّل YouTube Data API v3.",
      },
    ];

    const enabledCount = checks.filter((item) => item.enabled).length;
    const configuredEnabledCount = checks.filter((item) => item.enabled && item.isConfigured).length;

    return res.json({
      publicBaseUrl,
      apiBaseUrl,
      summary: {
        total: checks.length,
        enabled: enabledCount,
        configuredEnabled: configuredEnabledCount,
        blockers: checks.filter((item) => item.enabled && !item.isConfigured).map((item) => item.id),
      },
      checks,
    });
  }),
);

contentRouter.get(
  "/platform-integrations/runtime-audit",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    const settings = await PlatformIntegrationSettingsModel.findOne({ key: "default" }).lean();
    const runtimeSettings = settings
      ? decryptIntegrationSecretsForRuntime(settings as unknown as Record<string, unknown>)
      : null;
    const providers = (runtimeSettings?.providers as Record<string, Record<string, unknown>> | undefined) || {};

    const isDbConfigured = {
      google: Boolean(providers.google?.clientId && providers.google?.clientSecret),
      facebook: Boolean(providers.facebook?.clientId && providers.facebook?.clientSecret),
      whatsapp: Boolean(providers.whatsapp?.accessToken && providers.whatsapp?.phoneNumberId && providers.whatsapp?.verifyToken),
      email: Boolean(providers.email?.apiKey && providers.email?.fromEmail),
      sentry: Boolean(providers.sentry?.accessToken),
      redis: Boolean(providers.redis?.accessToken),
    };

    const emailProvider = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
    const emailEnvConfigured =
      emailProvider === "console" ||
      (emailProvider === "resend" && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)) ||
      (emailProvider === "http" && Boolean(process.env.EMAIL_WEBHOOK_URL && process.env.EMAIL_WEBHOOK_URL.trim()));

    const whatsappProvider = String(process.env.WHATSAPP_PROVIDER || "").trim().toLowerCase();
    const whatsappEnvConfigured =
      whatsappProvider === "console" ||
      (whatsappProvider === "whatsapp_cloud" &&
        Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_VERIFY_TOKEN)) ||
      (whatsappProvider === "http" && Boolean(process.env.WHATSAPP_WEBHOOK_URL && process.env.WHATSAPP_WEBHOOK_URL.trim()));

    const redisHealth = await getRedisHealth("queue", { required: false, timeoutMs: 1500 });
    const sentryEnvConfigured = Boolean(String(process.env.SENTRY_DSN || "").trim());

    const items = [
      {
        id: "google",
        title: "Google OAuth",
        enabled: Boolean(providers.google?.enabled),
        dbConfigured: isDbConfigured.google,
        envConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
      {
        id: "facebook",
        title: "Facebook OAuth",
        enabled: Boolean(providers.facebook?.enabled),
        dbConfigured: isDbConfigured.facebook,
        envConfigured: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
      },
      {
        id: "email",
        title: "Email Provider",
        enabled: Boolean(providers.email?.enabled),
        dbConfigured: isDbConfigured.email,
        envConfigured: emailEnvConfigured,
      },
      {
        id: "whatsapp",
        title: "WhatsApp Provider",
        enabled: Boolean(providers.whatsapp?.enabled),
        dbConfigured: isDbConfigured.whatsapp,
        envConfigured: whatsappEnvConfigured,
      },
      {
        id: "sentry",
        title: "Sentry",
        enabled: Boolean(providers.sentry?.enabled),
        dbConfigured: isDbConfigured.sentry,
        envConfigured: sentryEnvConfigured,
      },
      {
        id: "redis",
        title: "Redis Managed",
        enabled: Boolean(providers.redis?.enabled),
        dbConfigured: isDbConfigured.redis,
        envConfigured: isRedisConfigured(),
        health: {
          ok: redisHealth.ok,
          status: redisHealth.status,
          latencyMs: redisHealth.latencyMs ?? null,
          error: redisHealth.error || "",
        },
      },
    ].map((item) => {
      const runtimeReady = item.enabled ? item.dbConfigured && item.envConfigured : true;
      return { ...item, runtimeReady };
    });

    return res.json({
      summary: {
        total: items.length,
        enabled: items.filter((item) => item.enabled).length,
        runtimeReady: items.filter((item) => item.enabled && item.runtimeReady).length,
        blocked: items.filter((item) => item.enabled && !item.runtimeReady).map((item) => item.id),
      },
      items,
    });
  }),
);

contentRouter.post(
  "/platform-integrations/history/:id/restore",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const item = await PlatformIntegrationHistoryModel.findById(req.params.id).lean();
    if (!item?.snapshot || typeof item.snapshot !== "object") {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "History snapshot not found." });
    }

    const runtimeSnapshot = decryptIntegrationSecretsForRuntime(item.snapshot as Record<string, unknown>);
    const parsedSnapshot = platformIntegrationSettingsSchema.parse(runtimeSnapshot as Record<string, unknown>);
    const encryptedPayload = encryptIntegrationSecretsAtRest(parsedSnapshot as unknown as Record<string, unknown>);
    const settings = await PlatformIntegrationSettingsModel.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          ...encryptedPayload,
          updatedBy: req.authUser?.id || "",
        },
        $setOnInsert: { key: "default" },
      },
      { new: true, upsert: true },
    );

    await PlatformIntegrationHistoryModel.create({
      settingsKey: "default",
      snapshot: settings?.toJSON?.() || settings,
      updatedBy: req.authUser?.id || "",
      note: `restore from ${String(req.params.id)}`,
    });

    const runtimeSettings = decryptIntegrationSecretsForRuntime((settings?.toJSON ? settings.toJSON() : settings) as Record<string, unknown>);
    const safeSettings = maskSensitiveProviderValues(runtimeSettings);
    return res.json({ settings: safeSettings, restoredFrom: req.params.id });
  }),
);

contentRouter.post(
  "/schools/:id/relations",
  requireAuth,
  requireRole(["admin", "supervisor"]),
  asyncHandler(async (req, res) => {
    const payload = schoolRelationSchema.parse(req.body);
    const school = await GroupModel.findOne({
      ...buildDocumentQuery(req.params.id),
      type: "SCHOOL",
    });

    if (!school) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "School not found" });
    }

    const schoolId = school.id || String(school._id);
    const canManageSchool = await assertSchoolManagementScope(req.authUser!, school as any);

    if (!canManageSchool) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: "You cannot manage this school" });
    }

    const classes = await GroupModel.find({ type: "CLASS", parentId: schoolId }).sort({ createdAt: -1 });
    const classByName = new Map(classes.map((item) => [String(item.name || "").trim().toLowerCase(), item]));
    const studentEmails = payload.rows.map((row) => row.studentEmail.trim().toLowerCase());
    const parentEmails = payload.rows.map((row) => String(row.parentEmail || "").trim().toLowerCase()).filter(Boolean);
    const supervisorEmails = payload.rows.map((row) => String(row.supervisorEmail || "").trim().toLowerCase()).filter(Boolean);
    const allEmails = Array.from(new Set([...studentEmails, ...parentEmails, ...supervisorEmails]));
    const users = await UserModel.find({ email: { $in: allEmails } });
    const usersByEmail = new Map(users.map((item) => [String(item.email || "").trim().toLowerCase(), item]));
    const credentials: Array<{ role: "parent" | "supervisor"; name: string; email: string; password: string; linkedTo: string }> = [];
    const summary = {
      rows: payload.rows.length,
      createdParents: 0,
      createdSupervisors: 0,
      linkedParents: 0,
      linkedSupervisors: 0,
      assignedClasses: 0,
      missingStudents: 0,
      missingParents: 0,
      missingSupervisors: 0,
      missingClasses: 0,
      skippedRows: 0,
    };

    const createUserIfMissing = async (
      email: string,
      role: "parent" | "supervisor",
      name: string,
      linkedTo: string,
    ) => {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = usersByEmail.get(normalizedEmail);
      if (existing || !payload.createMissingUsers) return existing;

      const password = `Alm@${Math.random().toString(36).slice(2, 10)}`;
      const created = await UserModel.create({
        name,
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        isActive: true,
        schoolId,
        groupIds: role === "supervisor" ? [schoolId] : [],
        linkedStudentIds: [],
      });

      usersByEmail.set(normalizedEmail, created);
      credentials.push({ role, name: created.name, email: normalizedEmail, password, linkedTo });
      if (role === "parent") summary.createdParents += 1;
      if (role === "supervisor") summary.createdSupervisors += 1;
      return created;
    };

    for (const row of payload.rows) {
      const studentEmail = row.studentEmail.trim().toLowerCase();
      if (!studentEmail) {
        summary.skippedRows += 1;
        continue;
      }

      const student = usersByEmail.get(studentEmail);
      if (!student || student.role !== "student" || String(student.schoolId || "") !== schoolId) {
        summary.missingStudents += 1;
        continue;
      }

      const className = String(row.className || "").trim();
      const classroom = className ? classByName.get(className.toLowerCase()) : undefined;
      if (className && !classroom) {
        summary.missingClasses += 1;
      }

      if (classroom) {
        const classId = classroom.id || String(classroom._id);
        await Promise.all([
          UserModel.findByIdAndUpdate(student._id, { $set: { schoolId }, $addToSet: { groupIds: classId } }),
          GroupModel.findOneAndUpdate(buildDocumentQuery(classId), { $addToSet: { studentIds: student.id || String(student._id) } }),
          GroupModel.findOneAndUpdate(buildDocumentQuery(schoolId), { $addToSet: { studentIds: student.id || String(student._id) } }),
        ]);
        summary.assignedClasses += 1;
      }

      const parentEmail = String(row.parentEmail || "").trim().toLowerCase();
      if (parentEmail) {
        const parent = await createUserIfMissing(
          parentEmail,
          "parent",
          row.parentName?.trim() || `ولي أمر ${student.name}`,
          student.name,
        );
        if (!parent) {
          summary.missingParents += 1;
        } else {
          await UserModel.findByIdAndUpdate(parent._id, { $set: { schoolId }, $addToSet: { linkedStudentIds: student.id || String(student._id) } });
          summary.linkedParents += 1;
        }
      }

      const supervisorEmail = String(row.supervisorEmail || "").trim().toLowerCase();
      if (supervisorEmail) {
        const supervisor = await createUserIfMissing(
          supervisorEmail,
          "supervisor",
          row.supervisorName?.trim() || `مشرف ${school.name}`,
          classroom?.name || school.name,
        );
        if (!supervisor) {
          summary.missingSupervisors += 1;
        } else {
          const targetGroupId = classroom ? classroom.id || String(classroom._id) : schoolId;
          await Promise.all([
            UserModel.findByIdAndUpdate(supervisor._id, { $set: { schoolId }, $addToSet: { groupIds: targetGroupId } }),
            GroupModel.findOneAndUpdate(buildDocumentQuery(targetGroupId), { $addToSet: { supervisorIds: supervisor.id || String(supervisor._id) } }),
          ]);
          summary.linkedSupervisors += 1;
        }
      }
    }

    const latestClasses = await GroupModel.find({ type: "CLASS", parentId: schoolId });
    await Promise.all([
      GroupModel.findOneAndUpdate(buildDocumentQuery(schoolId), {
        $set: {
          totalStudents: await UserModel.countDocuments({ schoolId, role: "student" }),
          totalSupervisors: await UserModel.countDocuments({ schoolId, role: { $in: ["teacher", "supervisor"] } }),
        },
      }),
      ...latestClasses.map(async (group) => {
        const classId = group.id || String(group._id);
        const [studentCount, supervisorCount] = await Promise.all([
          UserModel.countDocuments({ role: "student", groupIds: classId }),
          UserModel.countDocuments({ role: { $in: ["teacher", "supervisor"] }, groupIds: classId }),
        ]);
        await GroupModel.findOneAndUpdate(buildDocumentQuery(classId), {
          $set: { totalStudents: studentCount, totalSupervisors: supervisorCount },
        });
      }),
    ]);

    const [updatedGroups, updatedUsers] = await Promise.all([
      GroupModel.find({
        $or: [{ _id: school._id }, { id: schoolId }, { parentId: schoolId }],
      }).sort({ createdAt: -1 }),
      UserModel.find({ schoolId }).select("-passwordHash").sort({ createdAt: -1 }),
    ]);

    return res.status(StatusCodes.CREATED).json({
      summary,
      credentials,
      groups: updatedGroups,
      users: updatedUsers,
    });
  }),
);
