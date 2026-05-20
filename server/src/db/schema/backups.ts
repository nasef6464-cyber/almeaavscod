import { pgTable, text, varchar, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

// ============================================================
// Backup: Snapshots & Activities
// ============================================================

export const backupSnapshots = pgTable("backup_snapshots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  type: varchar("type", { length: 20 }).default("manual"),
  status: varchar("status", { length: 20 }).default("completed"),
  size: text("size").default(""),
  tableCount: integer("table_count").default(0),
  recordCount: integer("record_count").default(0),
  tables: jsonb("tables"),
  filePath: text("file_path").default(""),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_backup_snapshots_status").on(table.status),
  index("idx_backup_snapshots_type").on(table.type),
  index("idx_backup_snapshots_created_at").on(table.createdAt),
]);

export const backupActivities = pgTable("backup_activities", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id"),
  action: varchar("action", { length: 50 }).notNull(),
  description: text("description").default(""),
  status: varchar("status", { length: 20 }).default("completed"),
  details: jsonb("details"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_backup_activities_snapshot_id").on(table.snapshotId),
  index("idx_backup_activities_action").on(table.action),
  index("idx_backup_activities_created_at").on(table.createdAt),
]);
