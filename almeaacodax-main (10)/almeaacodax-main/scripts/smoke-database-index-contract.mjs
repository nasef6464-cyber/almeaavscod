import { readFile } from "node:fs/promises";

const files = {
  topic: await readFile(new URL("../server/src/models/Topic.ts", import.meta.url), "utf8"),
  lesson: await readFile(new URL("../server/src/models/Lesson.ts", import.meta.url), "utf8"),
  library: await readFile(new URL("../server/src/models/LibraryItem.ts", import.meta.url), "utf8"),
  course: await readFile(new URL("../server/src/models/Course.ts", import.meta.url), "utf8"),
  user: await readFile(new URL("../server/src/models/User.ts", import.meta.url), "utf8"),
  path: await readFile(new URL("../server/src/models/Path.ts", import.meta.url), "utf8"),
  level: await readFile(new URL("../server/src/models/Level.ts", import.meta.url), "utf8"),
  subject: await readFile(new URL("../server/src/models/Subject.ts", import.meta.url), "utf8"),
  section: await readFile(new URL("../server/src/models/Section.ts", import.meta.url), "utf8"),
  skill: await readFile(new URL("../server/src/models/Skill.ts", import.meta.url), "utf8"),
  payment: await readFile(new URL("../server/src/models/PaymentRequest.ts", import.meta.url), "utf8"),
  accessGrant: await readFile(new URL("../server/src/models/AccessGrant.ts", import.meta.url), "utf8"),
  discount: await readFile(new URL("../server/src/models/DiscountCode.ts", import.meta.url), "utf8"),
  audit: await readFile(new URL("../server/src/models/AdminAuditLog.ts", import.meta.url), "utf8"),
  ai: await readFile(new URL("../server/src/models/AiInteraction.ts", import.meta.url), "utf8"),
  db: await readFile(new URL("../server/src/config/db.ts", import.meta.url), "utf8"),
  env: await readFile(new URL("../server/src/config/env.ts", import.meta.url), "utf8"),
  pagination: await readFile(new URL("../server/src/utils/pagination.ts", import.meta.url), "utf8"),
  guide: await readFile(new URL("../DATABASE_REVIEW.md", import.meta.url), "utf8"),
  readiness: await readFile(new URL("../PRODUCTION_READINESS_REPORT.md", import.meta.url), "utf8"),
};

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", message: error.message });
  }
}

function assertIncludes(source, fragment) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing fragment: ${fragment}`);
  }
}

check("learning-space models have path/subject visibility indexes", () => {
  assertIncludes(files.topic, "topicSchema.index({ pathId: 1, subjectId: 1, sectionId: 1, showOnPlatform: 1, order: 1 })");
  assertIncludes(files.lesson, "lessonSchema.index({ pathId: 1, subjectId: 1, sectionId: 1, showOnPlatform: 1, createdAt: -1 })");
  assertIncludes(files.library, "libraryItemSchema.index({ pathId: 1, subjectId: 1, sectionId: 1, showOnPlatform: 1, createdAt: -1 })");
});

check("taxonomy bootstrap models have compound lookup indexes", () => {
  assertIncludes(files.path, "pathSchema.index({ isActive: 1, createdAt: 1 })");
  assertIncludes(files.level, "levelSchema.index({ pathId: 1, createdAt: 1 })");
  assertIncludes(files.subject, "subjectSchema.index({ pathId: 1, createdAt: 1 })");
  assertIncludes(files.section, "sectionSchema.index({ subjectId: 1, createdAt: 1 })");
  assertIncludes(files.skill, "skillSchema.index({ pathId: 1, subjectId: 1, sectionId: 1, createdAt: 1 })");
});

check("package and access models have discovery indexes", () => {
  assertIncludes(files.course, "courseSchema.index({ isPackage: 1, packageType: 1, isPublished: 1, showOnPlatform: 1, createdAt: -1 })");
  assertIncludes(files.course, "courseSchema.index({ packageContentTypes: 1, isPublished: 1, showOnPlatform: 1 })");
  assertIncludes(files.user, 'userSchema.index({ "subscription.purchasedPackages": 1 })');
});

check("payment and discount models have admin review indexes", () => {
  assertIncludes(files.payment, "paymentRequestSchema.index({ status: 1, createdAt: -1 })");
  assertIncludes(files.payment, "paymentRequestSchema.index({ userId: 1, status: 1, createdAt: -1 })");
  assertIncludes(files.discount, "discountCodeSchema.index({ status: 1, expiresAt: 1 })");
});

check("operations models have observability indexes", () => {
  assertIncludes(files.audit, "adminAuditLogSchema.index({ action: 1, status: 1, createdAt: -1 })");
  assertIncludes(files.ai, "aiInteractionSchema.index({ endpoint: 1, audience: 1, createdAt: -1 })");
});

check("access grants have atomic ledger indexes for future purchase hardening", () => {
  assertIncludes(files.accessGrant, "export const AccessGrantModel");
  assertIncludes(files.accessGrant, 'idempotencyKey: { type: String, required: true, unique: true, index: true }');
  assertIncludes(files.accessGrant, 'accessGrantSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true })');
  assertIncludes(files.accessGrant, "accessGrantSchema.index({ userId: 1, status: 1, grantedAt: -1 })");
  assertIncludes(files.accessGrant, "accessGrantSchema.index({ userId: 1, packageId: 1, status: 1 })");
});

check("mongodb connection has explicit production pooling controls", () => {
  assertIncludes(files.env, "MONGODB_MAX_POOL_SIZE");
  assertIncludes(files.env, "MONGODB_MIN_POOL_SIZE");
  assertIncludes(files.env, "MONGODB_SERVER_SELECTION_TIMEOUT_MS");
  assertIncludes(files.env, "MONGODB_SOCKET_TIMEOUT_MS");
  assertIncludes(files.env, "MONGODB_MAX_IDLE_TIME_MS");
  assertIncludes(files.db, "maxPoolSize: env.MONGODB_MAX_POOL_SIZE");
  assertIncludes(files.db, 'mongoose.connection.on("connected"');
  assertIncludes(files.db, 'mongoose.connection.on("error"');
});

check("pagination utility defines the standard future list contract", () => {
  assertIncludes(files.pagination, "paginationQuerySchema");
  assertIncludes(files.pagination, "resolvePagination");
  assertIncludes(files.pagination, "buildPaginatedResponse");
  assertIncludes(files.pagination, "totalPages");
});

check("database review documents index scope and scaling limits", () => {
  assertIncludes(files.guide, "Indexes Added");
  assertIncludes(files.guide, "No destructive migration was added");
  assertIncludes(files.guide, "do not prove 10k-user readiness");
  assertIncludes(files.readiness, "Database Index Sprint - 2026-05-12");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Database index contract passed (${checks.length} checks).`);
