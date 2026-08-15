import { sql } from "drizzle-orm";
import {
  AnySQLiteColumn,
  integer,
  index,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => text(name).notNull();

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash"),
    nickname: text("nickname"),
    profileEmail: text("profile_email"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)]
);

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => entries.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    completionMode: text("completion_mode", {
      enum: ["ongoing", "completable"],
    }).notNull(),
    status: text("status", {
      enum: ["active", "paused", "completed", "archived"],
    }).notNull(),
    dueAt: text("due_at"),
    sortKey: text("sort_key").notNull(),
    deletedAt: text("deleted_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("entries_user_parent_idx").on(table.userId, table.parentId),
    index("entries_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
);

export const weekPlans = sqliteTable(
  "week_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [uniqueIndex("week_plans_user_week_unique").on(table.userId, table.weekStart)]
);

export const weekPlanEntries = sqliteTable(
  "week_plan_entries",
  {
    id: text("id").primaryKey(),
    weekPlanId: text("week_plan_id")
      .notNull()
      .references(() => weekPlans.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "restrict" }),
    source: text("source", { enum: ["manual", "rollover"] }).notNull(),
    role: text("role", { enum: ["focus", "commitment"] }).notNull().default("commitment"),
    plannedFocusSeconds: integer("planned_focus_seconds"),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [
    uniqueIndex("week_plan_entries_unique").on(table.weekPlanId, table.entryId),
    index("week_plan_entries_order_idx").on(table.weekPlanId, table.sortKey),
  ]
);

export const focusSessions = sqliteTable(
  "focus_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at"),
    endedAt: text("ended_at"),
    captureMode: text("capture_mode", { enum: ["timer", "manual"] }).notNull(),
    note: text("note"),
    outcome: text("outcome"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("focus_sessions_user_range_idx").on(table.userId, table.startedAt),
    uniqueIndex("focus_sessions_one_active_per_user")
      .on(table.userId)
      .where(sql`${table.endedAt} is null`),
  ]
);

export const focusSegments = sqliteTable(
  "focus_segments",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => focusSessions.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    entryId: text("entry_id").references(() => entries.id, {
      onDelete: "set null",
    }),
    note: text("note"),
  },
  (table) => [
    index("focus_segments_session_order_idx").on(table.sessionId, table.startedAt),
    index("focus_segments_entry_idx").on(table.entryId),
  ]
);

export const scheduleImports = sqliteTable(
  "schedule_imports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    createdAt: timestamp("created_at"),
    sourceKey: text("source_key"),
    sourceName: text("source_name"),
    updatedAt: timestamp("updated_at"),
    changeCount: integer("change_count").notNull().default(0),
  },
  (table) => [
    index("schedule_imports_user_created_idx").on(table.userId, table.createdAt),
    index("schedule_imports_user_source_idx").on(table.userId, table.sourceKey),
  ]
);

export const scheduleTemplates = sqliteTable(
  "schedule_templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("schedule_templates_user_updated_idx").on(table.userId, table.updatedAt)]
);

export const scheduleTemplateItems = sqliteTable(
  "schedule_template_items",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull().references(() => scheduleTemplates.id, { onDelete: "cascade" }),
    weekdaysJson: text("weekdays_json").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind", { enum: ["course", "plan", "other"] }).notNull(),
    location: text("location"),
    colorKey: text("color_key"),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    sortKey: text("sort_key").notNull(),
  },
  (table) => [index("schedule_template_items_template_order_idx").on(table.templateId, table.sortKey)]
);

export const scheduleTemplateApplications = sqliteTable(
  "schedule_template_applications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull().references(() => scheduleTemplates.id, { onDelete: "cascade" }),
    templateName: text("template_name").notNull(),
    fromDate: text("from_date").notNull(),
    toDate: text("to_date").notNull(),
    appliedAt: timestamp("applied_at"),
  },
  (table) => [index("schedule_template_applications_user_applied_idx").on(table.userId, table.appliedAt)]
);

export const scheduleBlocks = sqliteTable(
  "schedule_blocks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["course", "plan", "other"] }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    location: text("location"),
    colorKey: text("color_key"),
    recurrenceJson: text("recurrence_json"),
    source: text("source", { enum: ["manual", "ics", "template"] }).notNull(),
    importId: text("import_id").references(() => scheduleImports.id, { onDelete: "cascade" }),
    sourceUid: text("source_uid"),
    sourceInstanceKey: text("source_instance_key"),
    templateApplicationId: text("template_application_id").references(() => scheduleTemplateApplications.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("schedule_blocks_user_range_idx").on(table.userId, table.startedAt),
    index("schedule_blocks_import_instance_idx").on(table.importId, table.sourceInstanceKey),
    index("schedule_blocks_template_application_idx").on(table.templateApplicationId),
  ]
);

export const schema = {
  users,
  entries,
  weekPlans,
  weekPlanEntries,
  focusSessions,
  focusSegments,
  scheduleImports,
  scheduleBlocks,
  scheduleTemplates,
  scheduleTemplateItems,
  scheduleTemplateApplications,
};
