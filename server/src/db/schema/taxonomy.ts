import { pgTable, text, integer, varchar, jsonb, boolean, index } from "drizzle-orm/pg-core";

// ============================================================
// Taxonomy: Paths, Levels, Subjects, Sections, Skills
// ============================================================

export const paths = pgTable("paths", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  icon: text("icon"),
  iconUrl: text("icon_url"),
  iconStyle: text("icon_style"),
  showInNavbar: boolean("show_in_navbar").default(true),
  showInHome: boolean("show_in_home").default(true),
  isActive: boolean("is_active").default(true),
  parentPathId: text("parent_path_id"),
  description: text("description"),
}, (table) => [
  index("idx_paths_is_active").on(table.isActive),
  index("idx_paths_parent_path_id").on(table.parentPathId),
]);

export const levels = pgTable("levels", {
  id: text("id").primaryKey(),
  pathId: text("path_id").notNull(),
  name: text("name").notNull(),
}, (table) => [
  index("idx_levels_path_id").on(table.pathId),
]);

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  pathId: text("path_id").notNull(),
  levelId: text("level_id"),
  name: text("name").notNull(),
  color: text("color"),
  icon: text("icon"),
  iconUrl: text("icon_url"),
  iconStyle: text("icon_style"),
  settings: jsonb("settings"),
}, (table) => [
  index("idx_subjects_path_id").on(table.pathId),
  index("idx_subjects_level_id").on(table.levelId),
]);

export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  name: text("name").notNull(),
}, (table) => [
  index("idx_sections_subject_id").on(table.subjectId),
]);

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pathId: text("path_id").notNull(),
  subjectId: text("subject_id").notNull(),
  sectionId: text("section_id").notNull(),
  description: text("description").default(""),
  lessonIds: text("lesson_ids").array().default([]),
  questionIds: text("question_ids").array().default([]),
  createdAt: integer("created_at").default(0),
  updatedAt: integer("updated_at").default(0),
}, (table) => [
  index("idx_skills_path_id").on(table.pathId),
  index("idx_skills_subject_id").on(table.subjectId),
  index("idx_skills_section_id").on(table.sectionId),
]);
