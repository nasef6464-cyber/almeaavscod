import { pgTable, text, integer, boolean, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";

// ============================================================
// Users & Authentication
// ============================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  googleId: text("google_id"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar").default(""),
  role: varchar("role", { length: 20 }).notNull().default("student"),
  points: integer("points").default(0),
  badges: text("badges").array().default([]),
  subscriptionPlan: varchar("subscription_plan", { length: 20 }).default("free"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  purchasedCourses: text("purchased_courses").array().default([]),
  purchasedPackages: text("purchased_packages").array().default([]),
  isActive: boolean("is_active").default(true),
  isEmailVerified: boolean("is_email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at"),
  schoolId: text("school_id"),
  groupIds: text("group_ids").array().default([]),
  linkedStudentIds: text("linked_student_ids").array().default([]),
  managedPathIds: text("managed_path_ids").array().default([]),
  managedSubjectIds: text("managed_subject_ids").array().default([]),
  enrolledCourses: text("enrolled_courses").array().default([]),
  enrolledPaths: text("enrolled_paths").array().default([]),
  completedLessons: text("completed_lessons").array().default([]),
  favorites: text("favorites").array().default([]),
  reviewLater: text("review_later").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_role").on(table.role),
  index("idx_users_is_active").on(table.isActive),
  index("idx_users_school_id").on(table.schoolId),
  index("idx_users_subscription_plan").on(table.subscriptionPlan),
  index("idx_users_email_verification_token").on(table.emailVerificationToken),
  index("idx_users_password_reset_token").on(table.passwordResetToken),
]);
