import { pgTable, text, integer, varchar, timestamp, boolean, index } from "drizzle-orm/pg-core";

// ============================================================
// Commerce: B2B Packages, Access Codes, Payments, Study Plans
// ============================================================

export const b2bPackages = pgTable("b2b_packages", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  name: text("name").notNull(),
  courseIds: text("course_ids").array().default([]),
  contentTypes: text("content_types").array().default(["all"]),
  pathIds: text("path_ids").array().default([]),
  subjectIds: text("subject_ids").array().default([]),
  type: varchar("type", { length: 20 }).default("free_access"),
  discountPercentage: integer("discount_percentage"),
  maxStudents: integer("max_students").default(0),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: integer("created_at").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_b2b_packages_school_id").on(table.schoolId),
  index("idx_b2b_packages_status").on(table.status),
]);

export const accessCodes = pgTable("access_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  schoolId: text("school_id").notNull(),
  packageId: text("package_id").notNull(),
  maxUses: integer("max_uses").default(1),
  currentUses: integer("current_uses").default(0),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_access_codes_code").on(table.code),
  index("idx_access_codes_school_id").on(table.schoolId),
  index("idx_access_codes_package_id").on(table.packageId),
]);

export const paymentRequests = pgTable("payment_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").default(""),
  userEmail: text("user_email").default(""),
  itemType: varchar("item_type", { length: 20 }).notNull(),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  packageId: text("package_id").default(""),
  includedCourseIds: text("included_course_ids").array().default([]),
  amount: integer("amount").default(0),
  currency: text("currency").default("SAR"),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  transferReference: text("transfer_reference").default(""),
  walletNumber: text("wallet_number").default(""),
  receiptUrl: text("receipt_url").default(""),
  notes: text("notes").default(""),
  reviewedBy: text("reviewed_by").default(""),
  reviewedAt: integer("reviewed_at"),
  reviewerNotes: text("reviewer_notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_requests_user_id").on(table.userId),
  index("idx_payment_requests_status").on(table.status),
  index("idx_payment_requests_item_type").on(table.itemType),
  index("idx_payment_requests_created_at").on(table.createdAt),
]);

export const paymentSettings = pgTable("payment_settings", {
  id: text("id").primaryKey(),
  bankName: text("bank_name"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  iban: text("iban"),
  walletNumber: text("wallet_number"),
  enableCard: boolean("enable_card").default(false),
  enableTransfer: boolean("enable_transfer").default(false),
  enableWallet: boolean("enable_wallet").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const studyPlans = pgTable("study_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  pathId: text("path_id").notNull(),
  subjectIds: text("subject_ids").array().default([]),
  courseIds: text("course_ids").array().default([]),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  skipCompletedQuizzes: boolean("skip_completed_quizzes").default(true),
  offDays: text("off_days").array().default([]),
  dailyMinutes: integer("daily_minutes").default(90),
  preferredStartTime: text("preferred_start_time").default("17:00"),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: integer("created_at").default(0),
  updatedAt: integer("updated_at").default(0),
}, (table) => [
  index("idx_study_plans_user_id").on(table.userId),
  index("idx_study_plans_status").on(table.status),
]);
