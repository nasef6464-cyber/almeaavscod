import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";

// ============================================================
// Commerce Extensions: Discount Codes, Access Grants, Announcement Ads, Integrations
// ============================================================

export const discountCodes = pgTable("discount_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("percentage"),
  value: integer("value").notNull(),
  maxUses: integer("max_uses").default(0),
  currentUses: integer("current_uses").default(0),
  minPurchaseAmount: integer("min_purchase_amount").default(0),
  applicableCourseIds: text("applicable_course_ids").array().default([]),
  applicablePackageIds: text("applicable_package_ids").array().default([]),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_discount_codes_code").on(table.code),
  index("idx_discount_codes_is_active").on(table.isActive),
  index("idx_discount_codes_expires_at").on(table.expiresAt),
]);

export const accessGrants = pgTable("access_grants", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  grantedBy: text("granted_by").notNull(),
  itemType: varchar("item_type", { length: 20 }).notNull(),
  itemId: text("item_id").notNull(),
  reason: text("reason").default(""),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_access_grants_user_id").on(table.userId),
  index("idx_access_grants_item_type").on(table.itemType),
  index("idx_access_grants_item_id").on(table.itemId),
]);

export const announcementAds = pgTable("announcement_ads", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: varchar("type", { length: 20 }).default("banner"),
  position: varchar("position", { length: 20 }).default("top"),
  imageUrl: text("image_url").default(""),
  linkUrl: text("link_url").default(""),
  targetRoles: text("target_roles").array().default([]),
  targetPaths: text("target_paths").array().default([]),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_announcement_ads_is_active").on(table.isActive),
  index("idx_announcement_ads_type").on(table.type),
  index("idx_announcement_ads_position").on(table.position),
]);

export const platformIntegrationSettings = pgTable("platform_integration_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_platform_integration_settings_key").on(table.key),
]);
