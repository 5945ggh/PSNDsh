import { sql } from "drizzle-orm";
import {
  AnySQLiteColumn,
  integer,
  index,
  real,
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

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    secretHash: text("secret_hash").notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at"),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [index("api_keys_user_created_idx").on(table.userId, table.createdAt)]
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

export const expenseCategories = sqliteTable(
  "expense_categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    archivedAt: text("archived_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("expense_categories_user_archived_idx").on(table.userId, table.archivedAt)]
);

export const expenseTags = sqliteTable(
  "expense_tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    archivedAt: text("archived_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("expense_tags_user_archived_idx").on(table.userId, table.archivedAt)]
);

export const paymentMethods = sqliteTable(
  "payment_methods",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    archivedAt: text("archived_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("payment_methods_user_archived_idx").on(table.userId, table.archivedAt)]
);

export const expenses = sqliteTable(
  "expenses",
  {
    // rowId is only an internal relation key. id remains the client UUID.
    rowId: text("row_id").primaryKey(),
    id: text("id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency", { enum: ["CNY"] }).notNull().default("CNY"),
    occurredAt: text("occurred_at"),
    occurredOn: text("occurred_on"),
    occurredTimezone: text("occurred_timezone"),
    occurrencePrecision: text("occurrence_precision", { enum: ["datetime", "date"] }).notNull(),
    recordedAt: timestamp("recorded_at"),
    captureMessage: text("capture_message"),
    note: text("note"),
    categoryId: text("category_id").references(() => expenseCategories.id, { onDelete: "restrict" }),
    paymentMethodId: text("payment_method_id").references(() => paymentMethods.id, { onDelete: "restrict" }),
    reviewStatus: text("review_status", { enum: ["pending", "reviewed"] }).notNull().default("pending"),
    recognitionStatus: text("recognition_status", { enum: ["recognized"] }).notNull().default("recognized"),
    recoverableCents: integer("recoverable_cents").notNull().default(0),
    settled: integer("settled", { mode: "boolean" }).notNull().default(false),
    source: text("source", { enum: ["shortcut", "manual"] }).notNull().default("shortcut"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    deletedAt: text("deleted_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    // Persisted from the effective timezone so SQLite can use the same keyset
    // ordering as the history UI without loading and sorting the full history.
    historyDateKey: text("history_date_key"),
    historyOccurredAtMs: integer("history_occurred_at_ms"),
    historyFallbackMs: integer("history_fallback_ms"),
  },
  (table) => [
    uniqueIndex("expenses_user_client_id_unique").on(table.userId, table.id),
    index("expenses_user_active_recorded_idx").on(table.userId, table.deletedAt, table.recordedAt),
    index("expenses_user_history_keyset_idx").on(table.userId, table.deletedAt, table.historyDateKey, table.historyOccurredAtMs, table.historyFallbackMs, table.id),
    index("expenses_user_inbox_idx").on(table.userId, table.reviewStatus, table.deletedAt, table.recordedAt),
  ]
);

export const expenseHistoryRevisions = sqliteTable(
  "expense_history_revisions",
  {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull().default(0),
  }
);

export const expenseRecordTags = sqliteTable(
  "expense_record_tags",
  {
    id: text("id").primaryKey(),
    expenseRowId: text("expense_row_id").notNull().references(() => expenses.rowId, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => expenseTags.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("expense_record_tags_unique").on(table.expenseRowId, table.tagId),
    index("expense_record_tags_tag_idx").on(table.tagId),
  ]
);

export const schema = {
  users,
  apiKeys,
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
  expenseCategories,
  expenseTags,
  paymentMethods,
  expenses,
  expenseRecordTags,
};
