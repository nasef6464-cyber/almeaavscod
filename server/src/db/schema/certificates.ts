import { pgTable, text, varchar, timestamp, integer, index } from "drizzle-orm/pg-core";

// ============================================================
// Certificates
// ============================================================

export const certificates = pgTable("certificates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  courseId: text("course_id").notNull(),
  courseTitle: text("course_title").notNull(),
  certificateNumber: text("certificate_number").notNull().unique(),
  verificationCode: text("verification_code").notNull().unique(),
  issuedAt: timestamp("issued_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_certificates_user_id").on(table.userId),
  index("idx_certificates_course_id").on(table.courseId),
  index("idx_certificates_verification_code").on(table.verificationCode),
  index("idx_certificates_certificate_number").on(table.certificateNumber),
]);
