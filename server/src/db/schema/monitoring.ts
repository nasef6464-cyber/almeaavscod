import { pgTable, text, varchar, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

// ============================================================
// Admin Audit Logs, AI Interactions, Client Events
// ============================================================

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  adminName: text("admin_name").default(""),
  action: varchar("action", { length: 50 }).notNull(),
  targetType: varchar("target_type", { length: 50 }).default(""),
  targetId: text("target_id").default(""),
  targetName: text("target_name").default(""),
  changes: jsonb("changes"),
  ipAddress: text("ip_address").default(""),
  userAgent: text("user_agent").default(""),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_admin_audit_logs_admin_id").on(table.adminId),
  index("idx_admin_audit_logs_action").on(table.action),
  index("idx_admin_audit_logs_target_type").on(table.targetType),
  index("idx_admin_audit_logs_created_at").on(table.createdAt),
]);

export const aiInteractions = pgTable("ai_interactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: varchar("provider", { length: 50 }).default(""),
  model: text("model").default(""),
  prompt: text("prompt").notNull(),
  response: text("response").default(""),
  tokensUsed: integer("tokens_used").default(0),
  durationMs: integer("duration_ms").default(0),
  status: varchar("status", { length: 20 }).default("completed"),
  errorMessage: text("error_message").default(""),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_interactions_user_id").on(table.userId),
  index("idx_ai_interactions_provider").on(table.provider),
  index("idx_ai_interactions_created_at").on(table.createdAt),
]);

export const clientEvents = pgTable("client_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").default(""),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventName: text("event_name").default(""),
  pageUrl: text("page_url").default(""),
  metadata: jsonb("metadata"),
  userAgent: text("user_agent").default(""),
  ipAddress: text("ip_address").default(""),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_events_user_id").on(table.userId),
  index("idx_client_events_event_type").on(table.eventType),
  index("idx_client_events_created_at").on(table.createdAt),
]);
