import { sql } from "drizzle-orm";
import {
  AnySQLiteColumn,
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

export const scheduleBlocks = sqliteTable(
  "schedule_blocks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["course", "plan", "other"] }).notNull(),
    title: text("title").notNull(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    location: text("location"),
    colorKey: text("color_key"),
    recurrenceJson: text("recurrence_json"),
    source: text("source", { enum: ["manual", "ics"] }).notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("schedule_blocks_user_range_idx").on(table.userId, table.startedAt)]
);

export const schema = {
  users,
  entries,
  weekPlans,
  weekPlanEntries,
  focusSessions,
  focusSegments,
  scheduleBlocks,
};
