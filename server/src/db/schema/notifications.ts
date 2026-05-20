import { pgTable, text, varchar, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

// ============================================================
// Notifications: Templates & Deliveries
// ============================================================

export const notificationTemplates = pgTable("notification_templates", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  key: text("key").unique(),
  name: text("name").notNull(),
  title: text("title").default(""),
  subject: text("subject").default(""),
  body: text("body").default(""),
  channels: text("channels").array().default(["in_app"]),
  subjectTemplate: text("subject_template").default(""),
  bodyTemplate: text("body_template").notNull(),
  variables: text("variables").array().default([]),
  enabled: integer("enabled").default(1),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notification_templates_key").on(table.key),
  index("idx_notification_templates_code").on(table.code),
  index("idx_notification_templates_is_active").on(table.isActive),
]);

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id"),
  templateKey: text("template_key"),
  userId: text("user_id").notNull(),
  recipientUserId: text("recipient_user_id"),
  channel: varchar("channel", { length: 20 }).notNull().default("in_app"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  title: text("title").default(""),
  body: text("body").default(""),
  subject: text("subject").default(""),
  recipientEmail: text("recipient_email").default(""),
  recipientPhone: text("recipient_phone").default(""),
  recipientRole: text("recipient_role").default(""),
  provider: text("provider").default(""),
  providerMessageId: text("provider_message_id").default(""),
  failureReason: text("failure_reason").default(""),
  retryCount: integer("retry_count").default(0),
  nextAttemptAt: timestamp("next_attempt_at"),
  metadata: jsonb("metadata"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  error: text("error"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notification_deliveries_user_id").on(table.userId),
  index("idx_notification_deliveries_campaign_id").on(table.campaignId),
  index("idx_notification_deliveries_status").on(table.status),
  index("idx_notification_deliveries_channel").on(table.channel),
  index("idx_notification_deliveries_next_attempt").on(table.nextAttemptAt),
]);
