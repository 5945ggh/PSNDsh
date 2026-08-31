import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import {
  apiKeys,
  entries,
  expenseCategories,
  expenseHistoryRevisions,
  expenseRecordTags,
  expenses,
  expenseTags,
  focusSegments,
  focusSessions,
  paymentMethods,
  scheduleBlocks,
  scheduleImports,
  scheduleTemplateApplications,
  scheduleTemplateItems,
  scheduleTemplates,
  users,
  weekPlanEntries,
  weekPlans,
} from "@/lib/db/schema";
import {
  ApplicationService,
  AddEntryInput,
  CaptureExpenseInput,
  CaptureExpenseResult,
  CreateExpenseDimensionInput,
  ExpenseApplicationService,
  ApiKeyApplicationService,
  ApiKeyCreated,
  ApiKeyMetadata,
  LoginInput,
  ManualFocusInput,
  MergeExpenseDimensionInput,
  RegisterInput,
  UpdateExpenseInput,
  UpdateEntryInput,
  ExpenseHistoryQuery,
} from "@/lib/application/contract";
import { ApplicationError } from "@/lib/application/error";
import { selectSeasonalQuotation } from "@/lib/ambient/quotations";
import {
  assertEntryMoveIsValid,
  assertEntryStatusIsValid,
  assertNoFocusOverlap,
  assertSegmentsPartitionSession,
} from "@/lib/mock/domain";
import {
  AuthSession,
  Capabilities,
  DashboardPayload,
  Entry,
  Expense,
  ExpenseDataExport,
  ExpenseCategory,
  ExpenseTag,
  FocusSegment,
  FocusSession,
  PaymentMethod,
  ScheduleBlock,
  ScheduleBlockInput,
  ScheduleImport,
  ScheduleTemplate,
  ScheduleTemplateApplication,
  ScheduleTemplateInput,
  ScheduleTemplateItem,
  ScheduleTemplatePreview,
  ScheduleRecurrence,
  UpdateScheduleBlockInput,
  StatisticsPayload,
  UserProfile,
  UserDataExport,
  WeekPlan,
  WeekPlanItem,
  WeekPlanItemInput,
} from "@/lib/domain/types";
import { assertValidWeekPlanItemInput, parseWeekStart, WEEK_START_MESSAGES } from "@/lib/domain/week-plan";
import { generateApiKey, revealApiKey } from "@/lib/security/api-key";
import {
  createExpenseHistoryCursor,
  decodeExpenseHistoryCursor,
  expenseHistorySortKey,
  sortExpensesForHistory,
} from "@/lib/expenses/history";

const DEFAULT_TIMEZONE = "Asia/Shanghai";
const DEFAULT_USER_ID = "usr_demo";

type ServiceOptions = {
  userId?: string | null;
  clock?: () => Date;
  effectiveTimezone?: string;
};

type EntryRow = typeof entries.$inferSelect;
type FocusSessionRow = typeof focusSessions.$inferSelect;
type FocusSegmentRow = typeof focusSegments.$inferSelect;
type ScheduleRow = typeof scheduleBlocks.$inferSelect;
type ScheduleTemplateRow = typeof scheduleTemplates.$inferSelect;
type ExpenseRow = typeof expenses.$inferSelect;

type ExpenseHistoryKeyRow = Pick<
  ExpenseRow,
  "rowId" | "id" | "occurredAt" | "occurredOn" | "occurrencePrecision" | "recordedAt" | "createdAt" | "updatedAt"
>;

const nowIso = (clock: () => Date) => clock().toISOString();

const normalizeOptionalText = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
};

const parseDate = (value: string) => new Date(value).getTime();

const assertPositiveRange = (startedAt: string, endedAt: string) => {
  const start = parseDate(startedAt);
  const end = parseDate(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new ApplicationError("SEGMENTS_INVALID_PARTITION", "时间范围必须是有效的正向区间");
  }
};

const getParts = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

const localDateKey = (value: Date, timezone: string) => {
  const parts = getParts(value, timezone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const shiftDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
};

const getTimezoneOffsetMs = (value: Date, timezone: string) => {
  const parts = getParts(value, timezone);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  ) - value.getTime();
};

const zonedMidnight = (dateKey: string, timezone: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const rough = new Date(Date.UTC(year, month - 1, day));
  return rough.getTime() - getTimezoneOffsetMs(rough, timezone);
};

const zonedDateTime = (dateKey: string, hour: number, minute: number, second: number, timezone: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const localMs = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = localMs;
  for (let index = 0; index < 2; index += 1) {
    instant = localMs - getTimezoneOffsetMs(new Date(instant), timezone);
  }
  return new Date(instant);
};

const mondayOf = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = value.getUTCDay();
  const distance = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  value.setUTCDate(value.getUTCDate() - distance);
  return value.toISOString().slice(0, 10);
};

const assertValidWeekStart = (weekStart: string) => {
  const issue = parseWeekStart(weekStart);
  if (issue) throw new ApplicationError("REQUEST_INVALID", WEEK_START_MESSAGES[issue]);
};

const daysBetween = (from: string, to: string) => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000);
};

const weekdayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const weekdayFor = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return weekdayCodes[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, encoded: string) => {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
};

const entryStatusIsVisible = (row: EntryRow) => row.deletedAt === null;

const normalizeCaptureMessage = (value: string | null | undefined) =>
  value === undefined || value === null || value === "" ? null : value;

const assertPositiveInteger = (value: number, message: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ApplicationError("EXPENSE_INVALID_AMOUNT", message);
  }
};

const assertDateTime = (value: string, message: string) => {
  if (!Number.isFinite(parseDate(value))) {
    throw new ApplicationError("REQUEST_INVALID", message);
  }
};

const assertDateKey = (value: string, message: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApplicationError("REQUEST_INVALID", message);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApplicationError("REQUEST_INVALID", message);
  }
};

const assertCoordinate = (value: number | null | undefined, min: number, max: number, label: string) => {
  if (value !== undefined && value !== null && (!Number.isFinite(value) || value < min || value > max)) {
    throw new ApplicationError("REQUEST_INVALID", `${label} 超出有效范围`);
  }
};

export class SqliteApplicationService implements ApplicationService, ExpenseApplicationService, ApiKeyApplicationService {
  private userId: string | null;
  private readonly clock: () => Date;
  private readonly timezone: string;

  constructor(
    private readonly db: AppDatabase,
    options: ServiceOptions = {}
  ) {
    this.userId = options.userId === undefined ? DEFAULT_USER_ID : options.userId;
    this.clock = options.clock ?? (() => new Date());
    this.timezone = options.effectiveTimezone ?? process.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE;
  }

  createApiKey(name: string): ApiKeyCreated {
    const normalized = name.trim();
    if (!normalized) throw new ApplicationError("REQUEST_INVALID", "API key 名称不能为空");
    const userId = this.requireUserId();
    const material = generateApiKey();
    const now = nowIso(this.clock);
    this.db.insert(apiKeys).values({ id: material.keyId, userId, secretHash: material.secretHash, encryptedSecret: material.encryptedSecret, name: normalized, createdAt: now, lastUsedAt: null, revokedAt: null }).run();
    return { id: material.keyId, name: normalized, createdAt: now, lastUsedAt: null, revokedAt: null, apiKey: material.apiKey };
  }

  listApiKeys(): ApiKeyMetadata[] {
    return this.db.select({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.userId, this.requireUserId())).orderBy(desc(apiKeys.createdAt)).all();
  }

  revealApiKey(id: string): string {
    const row = this.db.select().from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, this.requireUserId()))).get();
    if (!row) throw new ApplicationError("REQUEST_INVALID", "API key 不存在");
    const value = revealApiKey(row);
    if (!value) throw new ApplicationError("REQUEST_INVALID", "API key 无法解密，请轮换密钥");
    return value;
  }

  revokeApiKey(id: string): void {
    const now = nowIso(this.clock);
    const result = this.db.update(apiKeys).set({ revokedAt: now }).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, this.requireUserId()), isNull(apiKeys.revokedAt))).run();
    if (result.changes === 0) throw new ApplicationError("REQUEST_INVALID", "API key 不存在或已撤销");
  }

  private requireUserId() {
    if (!this.userId) {
      throw new ApplicationError("UNAUTHORIZED", "当前没有登录用户");
    }
    const user = this.db.select().from(users).where(eq(users.id, this.userId)).get();
    if (!user) throw new ApplicationError("UNAUTHORIZED", "当前用户不存在");
    return user.id;
  }

  private getUserRow() {
    if (!this.userId) return undefined;
    return this.db.select().from(users).where(eq(users.id, this.userId)).get();
  }

  private getOwnedEntryRow(id: string, includeDeleted = true) {
    const userId = this.requireUserId();
    const row = this.db
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), eq(entries.userId, userId)))
      .get();
    if (!row || (!includeDeleted && !entryStatusIsVisible(row))) {
      throw new ApplicationError("ENTRY_NOT_FOUND", "条目不存在");
    }
    return row;
  }

  private getOwnedExpenseRow(id: string, includeDeleted = true) {
    const row = this.db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, this.requireUserId())))
      .get();
    if (!row || (!includeDeleted && row.deletedAt !== null)) {
      throw new ApplicationError("EXPENSE_NOT_FOUND", "开销记录不存在");
    }
    return row;
  }

  private getOwnedExpenseCategory(id: string) {
    const row = this.db.select().from(expenseCategories)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, this.requireUserId()), isNull(expenseCategories.archivedAt)))
      .get();
    if (!row) throw new ApplicationError("EXPENSE_CATEGORY_NOT_FOUND", "分类不存在或已归档");
    return row;
  }

  private getOwnedExpenseCategoryIncludingArchived(id: string) {
    const row = this.db.select().from(expenseCategories)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, this.requireUserId())))
      .get();
    if (!row) throw new ApplicationError("EXPENSE_CATEGORY_NOT_FOUND", "分类不存在");
    return row;
  }

  private getOwnedExpenseCategoryByName(name: string, ignoreId?: string) {
    const normalized = name.trim().toLowerCase();
    const userId = this.requireUserId();
    return this.db.select({ id: expenseCategories.id, name: expenseCategories.name })
      .from(expenseCategories)
      .where(eq(expenseCategories.userId, userId))
      .all()
      .find((row) => row.id !== ignoreId && row.name.trim().toLowerCase() === normalized);
  }

  private getOwnedExpenseTag(id: string) {
    const row = this.db.select().from(expenseTags)
      .where(and(eq(expenseTags.id, id), eq(expenseTags.userId, this.requireUserId()), isNull(expenseTags.archivedAt)))
      .get();
    if (!row) throw new ApplicationError("EXPENSE_TAG_NOT_FOUND", "标签不存在或已归档");
    return row;
  }

  private getOwnedExpenseTagIncludingArchived(id: string) {
    const row = this.db.select().from(expenseTags)
      .where(and(eq(expenseTags.id, id), eq(expenseTags.userId, this.requireUserId())))
      .get();
    if (!row) throw new ApplicationError("EXPENSE_TAG_NOT_FOUND", "标签不存在");
    return row;
  }

  private getOwnedExpenseTagByName(name: string, ignoreId?: string) {
    const normalized = name.trim().toLowerCase();
    const userId = this.requireUserId();
    return this.db.select({ id: expenseTags.id, name: expenseTags.name })
      .from(expenseTags)
      .where(eq(expenseTags.userId, userId))
      .all()
      .find((row) => row.id !== ignoreId && row.name.trim().toLowerCase() === normalized);
  }

  private getOwnedPaymentMethod(id: string) {
    const row = this.db.select().from(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, this.requireUserId()), isNull(paymentMethods.archivedAt)))
      .get();
    if (!row) throw new ApplicationError("PAYMENT_METHOD_NOT_FOUND", "支付方式不存在或已归档");
    return row;
  }

  private getOwnedPaymentMethodIncludingArchived(id: string) {
    const row = this.db.select().from(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, this.requireUserId())))
      .get();
    if (!row) throw new ApplicationError("PAYMENT_METHOD_NOT_FOUND", "支付方式不存在");
    return row;
  }

  private getOwnedPaymentMethodByName(name: string, ignoreId?: string) {
    const normalized = name.trim().toLowerCase();
    const userId = this.requireUserId();
    return this.db.select({ id: paymentMethods.id, name: paymentMethods.name })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .all()
      .find((row) => row.id !== ignoreId && row.name.trim().toLowerCase() === normalized);
  }

  private getDirectFocusSecondsByEntry(userId: string) {
    const rows = this.db
      .select({
        entryId: focusSegments.entryId,
        startedAt: focusSegments.startedAt,
        endedAt: focusSegments.endedAt,
      })
      .from(focusSegments)
      .innerJoin(focusSessions, eq(focusSegments.sessionId, focusSessions.id))
      .where(and(eq(focusSessions.userId, userId), sql`${focusSessions.endedAt} is not null`))
      .all();
    const direct = new Map<string, number>();
    for (const segment of rows) {
      if (!segment.entryId) continue;
      const seconds = Math.max(0, (parseDate(segment.endedAt) - parseDate(segment.startedAt)) / 1000);
      direct.set(segment.entryId, (direct.get(segment.entryId) ?? 0) + seconds);
    }
    return direct;
  }

  private getEntryAggregates(rows: EntryRow[], direct: Map<string, number>) {
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const childrenByParentId = new Map<string, EntryRow[]>();
    for (const child of rows) {
      if (!child.parentId) continue;
      const children = childrenByParentId.get(child.parentId) ?? [];
      children.push(child);
      childrenByParentId.set(child.parentId, children);
    }

    const aggregate = new Map<string, number>();
    const calculate = (entryId: string): number => {
      const cached = aggregate.get(entryId);
      if (cached !== undefined) return cached;
      if (!rowsById.has(entryId)) return 0;
      const total = (direct.get(entryId) ?? 0) + (childrenByParentId.get(entryId) ?? [])
        .reduce((sum, child) => sum + calculate(child.id), 0);
      aggregate.set(entryId, total);
      return total;
    };
    rows.forEach((row) => calculate(row.id));
    return aggregate;
  }

  private toEntry(row: EntryRow, allRows?: EntryRow[], direct?: Map<string, number>): Entry {
    const rows = allRows ?? this.db.select().from(entries).where(eq(entries.userId, this.requireUserId())).all();
    const directByEntry = direct ?? this.getDirectFocusSecondsByEntry(this.requireUserId());
    const aggregates = this.getEntryAggregates(rows, directByEntry);
    const directFocusSeconds = directByEntry.get(row.id) ?? 0;
    return {
      id: row.id,
      parentId: row.parentId,
      title: row.title,
      description: row.description,
      completionMode: row.completionMode,
      status: row.status,
      dueAt: row.dueAt,
      directFocusSeconds,
      aggregateFocusSeconds: aggregates.get(row.id) ?? directFocusSeconds,
      sortKey: row.sortKey,
      deletedAt: row.deletedAt,
    };
  }

  private toEntries(rows: EntryRow[], direct: Map<string, number>): Entry[] {
    const aggregates = this.getEntryAggregates(rows, direct);
    return rows.map((row) => {
      const directFocusSeconds = direct.get(row.id) ?? 0;
      return {
        id: row.id,
        parentId: row.parentId,
        title: row.title,
        description: row.description,
        completionMode: row.completionMode,
        status: row.status,
        dueAt: row.dueAt,
        directFocusSeconds,
        aggregateFocusSeconds: aggregates.get(row.id) ?? directFocusSeconds,
        sortKey: row.sortKey,
        deletedAt: row.deletedAt,
      };
    });
  }

  private toUser(row: typeof users.$inferSelect): UserProfile {
    return {
      id: row.id,
      username: row.username,
      nickname: row.nickname,
      email: row.profileEmail,
    };
  }

  private toFocusSegment(row: FocusSegmentRow): FocusSegment {
    return {
      id: row.id,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      entryId: row.entryId,
      note: row.note,
    };
  }

  private toFocusSession(row: FocusSessionRow): FocusSession {
    const segmentRows = this.db
      .select()
      .from(focusSegments)
      .where(eq(focusSegments.sessionId, row.id))
      .orderBy(asc(focusSegments.startedAt))
      .all();
    return {
      id: row.id,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      captureMode: row.captureMode,
      note: row.note,
      outcome: row.outcome,
      segments: segmentRows.map((segment) => this.toFocusSegment(segment)),
    };
  }

  private toSchedule(row: ScheduleRow): ScheduleBlock {
    const recurrence = row.recurrenceJson
      ? (JSON.parse(row.recurrenceJson) as ScheduleRecurrence)
      : null;
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      location: row.location,
      colorKey: row.colorKey,
      recurrence,
      recurrenceLabel: recurrence ? `每周重复 (${recurrence.weekdays.join(", ")})` : null,
      source: row.source,
      importId: row.importId,
      sourceUid: row.sourceUid,
      sourceInstanceKey: row.sourceInstanceKey,
      templateApplicationId: row.templateApplicationId,
    };
  }

  private toExpenseCategory(row: typeof expenseCategories.$inferSelect): ExpenseCategory {
    return { id: row.id, name: row.name, iconKey: row.iconKey as ExpenseCategory["iconKey"] ?? null, archivedAt: row.archivedAt };
  }

  private toExpenseTag(row: typeof expenseTags.$inferSelect): ExpenseTag {
    return { id: row.id, name: row.name, iconKey: row.iconKey as ExpenseTag["iconKey"] ?? null, archivedAt: row.archivedAt };
  }

  private toPaymentMethod(row: typeof paymentMethods.$inferSelect): PaymentMethod {
    return { id: row.id, name: row.name, iconKey: row.iconKey as PaymentMethod["iconKey"] ?? null, archivedAt: row.archivedAt };
  }

  private toExpense(row: ExpenseRow): Expense {
    const categoryName = row.categoryId
      ? this.db.select({ name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.id, row.categoryId)).get()?.name ?? null
      : null;
    const paymentMethodName = row.paymentMethodId
      ? this.db.select({ name: paymentMethods.name }).from(paymentMethods).where(eq(paymentMethods.id, row.paymentMethodId)).get()?.name ?? null
      : null;
    const tags = this.db
      .select({
        id: expenseTags.id,
        name: expenseTags.name,
        archivedAt: expenseTags.archivedAt,
      })
      .from(expenseRecordTags)
      .innerJoin(expenseTags, eq(expenseRecordTags.tagId, expenseTags.id))
      .where(eq(expenseRecordTags.expenseRowId, row.rowId))
      .orderBy(asc(expenseTags.name))
      .all();
    return {
      id: row.id,
      amountCents: row.amountCents,
      currency: row.currency,
      occurredAt: row.occurredAt,
      occurredOn: row.occurredOn,
      occurredTimezone: row.occurredTimezone,
      occurrencePrecision: row.occurrencePrecision,
      recordedAt: row.recordedAt,
      captureMessage: row.captureMessage,
      note: row.note,
      categoryId: row.categoryId,
      categoryName,
      paymentMethodId: row.paymentMethodId,
      paymentMethodName,
      tags,
      reviewStatus: row.reviewStatus,
      recognitionStatus: row.recognitionStatus,
      recoverableCents: row.recoverableCents,
      settled: row.settled,
      source: row.source,
      latitude: row.latitude,
      longitude: row.longitude,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toExpenses(rows: ExpenseRow[]): Expense[] {
    if (rows.length === 0) return [];
    const categoryIds = rows.map((r) => r.categoryId).filter((v): v is string => Boolean(v));
    const paymentIds = rows.map((r) => r.paymentMethodId).filter((v): v is string => Boolean(v));
    const rowIds = rows.map((r) => r.rowId);
    const categories = new Map((categoryIds.length ? this.db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(inArray(expenseCategories.id, categoryIds)).all() : []).map((r) => [r.id, r.name]));
    const payments = new Map((paymentIds.length ? this.db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods).where(inArray(paymentMethods.id, paymentIds)).all() : []).map((r) => [r.id, r.name]));
    const tags = new Map<string, ExpenseTag[]>();
    if (rowIds.length) {
      this.db.select({ rowId: expenseRecordTags.expenseRowId, id: expenseTags.id, name: expenseTags.name, archivedAt: expenseTags.archivedAt })
        .from(expenseRecordTags).innerJoin(expenseTags, eq(expenseRecordTags.tagId, expenseTags.id))
        .where(inArray(expenseRecordTags.expenseRowId, rowIds)).orderBy(asc(expenseTags.name)).all()
        .forEach((tag) => tags.set(tag.rowId, [...(tags.get(tag.rowId) ?? []), { id: tag.id, name: tag.name, archivedAt: tag.archivedAt }]));
    }
    return rows.map((row) => ({ ...this.toExpenseBase(row), categoryName: row.categoryId ? categories.get(row.categoryId) ?? null : null, paymentMethodName: row.paymentMethodId ? payments.get(row.paymentMethodId) ?? null : null, tags: tags.get(row.rowId) ?? [] }));
  }

  private toExpenseBase(row: ExpenseRow): Omit<Expense, "categoryName" | "paymentMethodName" | "tags"> {
    return { id: row.id, amountCents: row.amountCents, currency: row.currency, occurredAt: row.occurredAt, occurredOn: row.occurredOn, occurredTimezone: row.occurredTimezone, occurrencePrecision: row.occurrencePrecision, recordedAt: row.recordedAt, captureMessage: row.captureMessage, note: row.note, categoryId: row.categoryId, paymentMethodId: row.paymentMethodId, reviewStatus: row.reviewStatus, recognitionStatus: row.recognitionStatus, recoverableCents: row.recoverableCents, settled: row.settled, source: row.source, latitude: row.latitude, longitude: row.longitude, deletedAt: row.deletedAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }

  private historyKey(row: ExpenseHistoryKeyRow) {
    return expenseHistorySortKey(row, this.timezone);
  }

  /**
   * 0007 cannot derive arbitrary IANA calendar dates in SQLite. Backfill only
   * legacy rows, without hydrating their dimensions; new writes always persist
   * these keys before they can appear in a paged query.
   */
  private ensureExpenseHistoryKeys(userId: string) {
    const batchSize = 250;
    for (;;) {
      const legacyRows = this.db.select({
        rowId: expenses.rowId,
        id: expenses.id,
        occurredAt: expenses.occurredAt,
        occurredOn: expenses.occurredOn,
        occurrencePrecision: expenses.occurrencePrecision,
        recordedAt: expenses.recordedAt,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      }).from(expenses).where(and(
        eq(expenses.userId, userId),
        isNull(expenses.deletedAt),
        isNull(expenses.historyDateKey),
      )).limit(batchSize).all() as ExpenseHistoryKeyRow[];
      if (legacyRows.length === 0) return;
      this.db.transaction((tx) => {
        for (const row of legacyRows) {
          const key = this.historyKey(row);
          tx.update(expenses).set({
            historyDateKey: key.dateKey,
            historyOccurredAtMs: key.occurredAtMs,
            historyFallbackMs: key.fallbackMs,
          }).where(eq(expenses.rowId, row.rowId)).run();
        }
      });
    }
  }

  private resolveCaptureOccurrence(input: CaptureExpenseInput, recordedAt: string) {
    const hasOccurredAt = input.occurredAt !== undefined;
    const hasOccurredOn = input.occurredOn !== undefined;
    if (hasOccurredAt && hasOccurredOn) {
      throw new ApplicationError("REQUEST_INVALID", "发生时间和发生日期只能提供一个");
    }

    const precision = input.occurrencePrecision
      ?? (hasOccurredOn ? "date" : "datetime");
    if (precision === "datetime") {
      if (hasOccurredOn) throw new ApplicationError("REQUEST_INVALID", "日期精度必须使用 occurredOn");
      const occurredAt = input.occurredAt ?? recordedAt;
      assertDateTime(occurredAt, "发生时间无效");
      return {
        occurredAt,
        occurredOn: null,
        occurredTimezone: input.occurredTimezone ?? this.timezone,
        occurrencePrecision: "datetime" as const,
      };
    }

    if (!input.occurredOn) {
      throw new ApplicationError("REQUEST_INVALID", "日期精度必须提供 occurredOn");
    }
    assertDateKey(input.occurredOn, "发生日期无效");
    return {
      occurredAt: null,
      occurredOn: input.occurredOn,
      occurredTimezone: input.occurredTimezone ?? this.timezone,
      occurrencePrecision: "date" as const,
    };
  }

  private getCaptureConflictFields(row: ExpenseRow, input: CaptureExpenseInput): string[] {
    const conflicts: string[] = [];
    if (input.amountCents !== row.amountCents) conflicts.push("amountCents");
    if (input.currency !== undefined && input.currency !== row.currency) conflicts.push("currency");
    if (input.occurredAt !== undefined && input.occurredAt !== row.occurredAt) conflicts.push("occurredAt");
    if (input.occurredOn !== undefined && input.occurredOn !== row.occurredOn) conflicts.push("occurredOn");
    if (input.occurredTimezone !== undefined && input.occurredTimezone !== row.occurredTimezone) conflicts.push("occurredTimezone");
    if (input.occurrencePrecision !== undefined && input.occurrencePrecision !== row.occurrencePrecision) conflicts.push("occurrencePrecision");
    if (input.captureMessage !== undefined && normalizeCaptureMessage(input.captureMessage) !== row.captureMessage) conflicts.push("captureMessage");
    if (input.latitude !== undefined && input.latitude !== row.latitude) conflicts.push("latitude");
    if (input.longitude !== undefined && input.longitude !== row.longitude) conflicts.push("longitude");
    if (input.source !== undefined && input.source !== row.source) conflicts.push("source");
    return conflicts;
  }

  private createExpenseDimension(
    input: CreateExpenseDimensionInput,
    insert: (row: { id: string; userId: string; name: string; iconKey: string | null; archivedAt: null; createdAt: string; updatedAt: string }) => void
  ) {
    const name = input.name.trim();
    if (!name) throw new ApplicationError("REQUEST_INVALID", "名称不能为空");
    const createdAt = nowIso(this.clock);
    const row = { id: randomUUID(), userId: this.requireUserId(), name, iconKey: input.iconKey ?? null, archivedAt: null, createdAt, updatedAt: createdAt };
    insert(row);
    return row;
  }

  createExpenseCategory(input: CreateExpenseDimensionInput): ExpenseCategory {
    const row = this.createExpenseDimension(input, (category) => {
      if (this.getOwnedExpenseCategoryByName(category.name)) {
        throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "分类名称已存在", { name: category.name });
      }
      this.db.insert(expenseCategories).values(category).run();
    });
    return this.toExpenseCategory(row);
  }

  getExpenseCategories(includeArchived = false): ExpenseCategory[] {
    const userId = this.requireUserId();
    return this.db.select().from(expenseCategories)
      .where(includeArchived ? eq(expenseCategories.userId, userId) : and(eq(expenseCategories.userId, userId), isNull(expenseCategories.archivedAt)))
      .orderBy(asc(expenseCategories.name))
      .all()
      .map((row) => this.toExpenseCategory(row));
  }

  renameExpenseCategory(id: string, input: CreateExpenseDimensionInput): ExpenseCategory {
    const row = this.getOwnedExpenseCategoryIncludingArchived(id);
    const name = input.name.trim();
    if (!name) throw new ApplicationError("REQUEST_INVALID", "名称不能为空");
    const conflict = this.getOwnedExpenseCategoryByName(name, row.id);
    if (conflict) {
      throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "分类名称已存在", { name });
    }
    const updatedAt = nowIso(this.clock);
    this.db.update(expenseCategories).set({ name, iconKey: input.iconKey, updatedAt })
      .where(and(eq(expenseCategories.id, row.id), eq(expenseCategories.userId, this.requireUserId())))
      .run();
    return this.toExpenseCategory(this.getOwnedExpenseCategoryIncludingArchived(id));
  }

  archiveExpenseCategory(id: string): ExpenseCategory {
    const row = this.getOwnedExpenseCategory(id);
    const archivedAt = nowIso(this.clock);
    this.db.update(expenseCategories).set({ archivedAt, updatedAt: archivedAt })
      .where(and(eq(expenseCategories.id, row.id), eq(expenseCategories.userId, this.requireUserId())))
      .run();
    return this.toExpenseCategory(this.getOwnedExpenseCategoryIncludingArchived(id));
  }

  restoreExpenseCategory(id: string): ExpenseCategory {
    const row = this.getOwnedExpenseCategoryIncludingArchived(id);
    if (row.archivedAt === null) {
      throw new ApplicationError("EXPENSE_DIMENSION_CONFLICT", "分类已经处于启用状态");
    }
    const conflict = this.getOwnedExpenseCategoryByName(row.name, row.id);
    if (conflict) {
      throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "分类名称已存在", { name: row.name });
    }
    const updatedAt = nowIso(this.clock);
    this.db.update(expenseCategories).set({ archivedAt: null, updatedAt })
      .where(and(eq(expenseCategories.id, row.id), eq(expenseCategories.userId, this.requireUserId())))
      .run();
    return this.toExpenseCategory({ ...row, archivedAt: null, updatedAt });
  }

  mergeExpenseCategory(id: string, input: MergeExpenseDimensionInput): ExpenseCategory {
    const source = this.getOwnedExpenseCategoryIncludingArchived(id);
    const target = this.getOwnedExpenseCategory(input.targetId);
    if (source.id === target.id) {
      throw new ApplicationError("EXPENSE_DIMENSION_CONFLICT", "不能合并到自身");
    }
    const updatedAt = nowIso(this.clock);
    const dateOnlyFallbackMs = Date.parse(updatedAt);
    this.db.transaction((tx) => {
      tx.update(expenses).set({
        categoryId: target.id,
        updatedAt,
        historyFallbackMs: sql<number>`CASE WHEN ${expenses.occurrencePrecision} = 'date' THEN ${dateOnlyFallbackMs} ELSE ${expenses.historyFallbackMs} END`,
      })
        .where(and(eq(expenses.userId, this.requireUserId()), eq(expenses.categoryId, source.id)))
        .run();
      tx.update(expenseCategories).set({ archivedAt: updatedAt, updatedAt })
        .where(and(eq(expenseCategories.id, source.id), eq(expenseCategories.userId, this.requireUserId())))
        .run();
    });
    return this.toExpenseCategory(this.getOwnedExpenseCategoryIncludingArchived(id));
  }

  createExpenseTag(input: CreateExpenseDimensionInput): ExpenseTag {
    const row = this.createExpenseDimension(input, (tag) => {
      if (this.getOwnedExpenseTagByName(tag.name)) {
        throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "标签名称已存在", { name: tag.name });
      }
      this.db.insert(expenseTags).values(tag).run();
    });
    return this.toExpenseTag(row);
  }

  getExpenseTags(includeArchived = false): ExpenseTag[] {
    const userId = this.requireUserId();
    return this.db.select().from(expenseTags)
      .where(includeArchived ? eq(expenseTags.userId, userId) : and(eq(expenseTags.userId, userId), isNull(expenseTags.archivedAt)))
      .orderBy(asc(expenseTags.name))
      .all()
      .map((row) => this.toExpenseTag(row));
  }

  renameExpenseTag(id: string, input: CreateExpenseDimensionInput): ExpenseTag {
    const row = this.getOwnedExpenseTagIncludingArchived(id);
    const name = input.name.trim();
    if (!name) throw new ApplicationError("REQUEST_INVALID", "名称不能为空");
    const conflict = this.getOwnedExpenseTagByName(name, row.id);
    if (conflict) {
      throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "标签名称已存在", { name });
    }
    const updatedAt = nowIso(this.clock);
    this.db.update(expenseTags).set({ name, iconKey: input.iconKey, updatedAt })
      .where(and(eq(expenseTags.id, row.id), eq(expenseTags.userId, this.requireUserId())))
      .run();
    return this.toExpenseTag(this.getOwnedExpenseTagIncludingArchived(id));
  }

  archiveExpenseTag(id: string): ExpenseTag {
    const row = this.getOwnedExpenseTag(id);
    const archivedAt = nowIso(this.clock);
    this.db.update(expenseTags).set({ archivedAt, updatedAt: archivedAt })
      .where(and(eq(expenseTags.id, row.id), eq(expenseTags.userId, this.requireUserId())))
      .run();
    return this.toExpenseTag(this.getOwnedExpenseTagIncludingArchived(id));
  }

  restoreExpenseTag(id: string): ExpenseTag {
    const row = this.getOwnedExpenseTagIncludingArchived(id);
    if (row.archivedAt === null) {
      throw new ApplicationError("EXPENSE_DIMENSION_CONFLICT", "标签已经处于启用状态");
    }
    const conflict = this.getOwnedExpenseTagByName(row.name, row.id);
    if (conflict) {
      throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "标签名称已存在", { name: row.name });
    }
    const updatedAt = nowIso(this.clock);
    this.db.update(expenseTags).set({ archivedAt: null, updatedAt })
      .where(and(eq(expenseTags.id, row.id), eq(expenseTags.userId, this.requireUserId())))
      .run();
    return this.toExpenseTag({ ...row, archivedAt: null, updatedAt });
  }

  mergeExpenseTag(id: string, input: MergeExpenseDimensionInput): ExpenseTag {
    const source = this.getOwnedExpenseTagIncludingArchived(id);
    const target = this.getOwnedExpenseTag(input.targetId);
    if (source.id === target.id) {
      throw new ApplicationError("EXPENSE_DIMENSION_CONFLICT", "不能合并到自身");
    }
    const updatedAt = nowIso(this.clock);
    this.db.transaction((tx) => {
      const duplicateExpenseRowIds = tx.select({ expenseRowId: expenseRecordTags.expenseRowId })
        .from(expenseRecordTags)
        .where(eq(expenseRecordTags.tagId, target.id))
        .all()
        .map((row) => row.expenseRowId);
      if (duplicateExpenseRowIds.length > 0) {
        tx.delete(expenseRecordTags).where(and(
          eq(expenseRecordTags.tagId, source.id),
          inArray(expenseRecordTags.expenseRowId, duplicateExpenseRowIds)
        )).run();
      }
      tx.update(expenseRecordTags).set({ tagId: target.id })
        .where(eq(expenseRecordTags.tagId, source.id))
        .run();
      tx.update(expenseTags).set({ archivedAt: updatedAt, updatedAt })
        .where(and(eq(expenseTags.id, source.id), eq(expenseTags.userId, this.requireUserId())))
        .run();
    });
    return this.toExpenseTag(this.getOwnedExpenseTagIncludingArchived(id));
  }

  createPaymentMethod(input: CreateExpenseDimensionInput): PaymentMethod {
    const row = this.createExpenseDimension(input, (method) => {
      if (this.getOwnedPaymentMethodByName(method.name)) {
        throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "支付方式名称已存在", { name: method.name });
      }
      this.db.insert(paymentMethods).values(method).run();
    });
    return this.toPaymentMethod(row);
  }

  getPaymentMethods(includeArchived = false): PaymentMethod[] {
    const userId = this.requireUserId();
    return this.db.select().from(paymentMethods)
      .where(includeArchived ? eq(paymentMethods.userId, userId) : and(eq(paymentMethods.userId, userId), isNull(paymentMethods.archivedAt)))
      .orderBy(asc(paymentMethods.name))
      .all()
      .map((row) => this.toPaymentMethod(row));
  }

  renamePaymentMethod(id: string, input: CreateExpenseDimensionInput): PaymentMethod {
    const row = this.getOwnedPaymentMethodIncludingArchived(id);
    const name = input.name.trim();
    if (!name) throw new ApplicationError("REQUEST_INVALID", "名称不能为空");
    const conflict = this.getOwnedPaymentMethodByName(name, row.id);
    if (conflict) {
      throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "支付方式名称已存在", { name });
    }
    const updatedAt = nowIso(this.clock);
    this.db.update(paymentMethods).set({ name, iconKey: input.iconKey, updatedAt })
      .where(and(eq(paymentMethods.id, row.id), eq(paymentMethods.userId, this.requireUserId())))
      .run();
    return this.toPaymentMethod(this.getOwnedPaymentMethodIncludingArchived(id));
  }

  archivePaymentMethod(id: string): PaymentMethod {
    const row = this.getOwnedPaymentMethod(id);
    const archivedAt = nowIso(this.clock);
    this.db.update(paymentMethods).set({ archivedAt, updatedAt: archivedAt })
      .where(and(eq(paymentMethods.id, row.id), eq(paymentMethods.userId, this.requireUserId())))
      .run();
    return this.toPaymentMethod(this.getOwnedPaymentMethodIncludingArchived(id));
  }

  restorePaymentMethod(id: string): PaymentMethod {
    const row = this.getOwnedPaymentMethodIncludingArchived(id);
    if (row.archivedAt === null) {
      throw new ApplicationError("EXPENSE_DIMENSION_CONFLICT", "支付方式已经处于启用状态");
    }
    const conflict = this.getOwnedPaymentMethodByName(row.name, row.id);
    if (conflict) {
      throw new ApplicationError("EXPENSE_DIMENSION_NAME_TAKEN", "支付方式名称已存在", { name: row.name });
    }
    const updatedAt = nowIso(this.clock);
    this.db.update(paymentMethods).set({ archivedAt: null, updatedAt })
      .where(and(eq(paymentMethods.id, row.id), eq(paymentMethods.userId, this.requireUserId())))
      .run();
    return this.toPaymentMethod({ ...row, archivedAt: null, updatedAt });
  }

  mergePaymentMethod(id: string, input: MergeExpenseDimensionInput): PaymentMethod {
    const source = this.getOwnedPaymentMethodIncludingArchived(id);
    const target = this.getOwnedPaymentMethod(input.targetId);
    if (source.id === target.id) {
      throw new ApplicationError("EXPENSE_DIMENSION_CONFLICT", "不能合并到自身");
    }
    const updatedAt = nowIso(this.clock);
    const dateOnlyFallbackMs = Date.parse(updatedAt);
    this.db.transaction((tx) => {
      tx.update(expenses).set({
        paymentMethodId: target.id,
        updatedAt,
        historyFallbackMs: sql<number>`CASE WHEN ${expenses.occurrencePrecision} = 'date' THEN ${dateOnlyFallbackMs} ELSE ${expenses.historyFallbackMs} END`,
      })
        .where(and(eq(expenses.userId, this.requireUserId()), eq(expenses.paymentMethodId, source.id)))
        .run();
      tx.update(paymentMethods).set({ archivedAt: updatedAt, updatedAt })
        .where(and(eq(paymentMethods.id, source.id), eq(paymentMethods.userId, this.requireUserId())))
        .run();
    });
    return this.toPaymentMethod(this.getOwnedPaymentMethodIncludingArchived(id));
  }

  captureExpense(input: CaptureExpenseInput): CaptureExpenseResult {
    if (!input.id.trim()) throw new ApplicationError("REQUEST_INVALID", "开销记录 UUID 不能为空");
    assertPositiveInteger(input.amountCents, "金额必须为正整数分");
    if (input.currency !== undefined && input.currency !== "CNY") {
      throw new ApplicationError("REQUEST_INVALID", "首版仅支持 CNY");
    }
    assertCoordinate(input.latitude, -90, 90, "纬度");
    assertCoordinate(input.longitude, -180, 180, "经度");

    const userId = this.requireUserId();
    const existing = this.db.select().from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.id, input.id)))
      .get();
    if (existing) {
      if (existing.deletedAt !== null) {
        throw new ApplicationError("EXPENSE_DELETED", "已删除的开销记录不能通过重试恢复", { id: input.id });
      }
      const conflictingFields = this.getCaptureConflictFields(existing, input);
      if (conflictingFields.length > 0) {
        throw new ApplicationError("EXPENSE_IDEMPOTENCY_CONFLICT", "同一 UUID 的捕获字段不一致", {
          id: input.id,
          conflictingFields,
        });
      }
      return { expense: this.toExpense(existing), created: false };
    }

    const recordedAt = nowIso(this.clock);
    const occurrence = this.resolveCaptureOccurrence(input, recordedAt);
    const row: typeof expenses.$inferInsert = {
      rowId: randomUUID(),
      id: input.id,
      userId,
      amountCents: input.amountCents,
      currency: "CNY",
      ...occurrence,
      recordedAt,
      captureMessage: normalizeCaptureMessage(input.captureMessage),
      note: null,
      categoryId: null,
      paymentMethodId: null,
      reviewStatus: "pending",
      recognitionStatus: "recognized",
      recoverableCents: 0,
      settled: false,
      source: input.source ?? "shortcut",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      deletedAt: null,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    };
    const historyKey = this.historyKey(row as ExpenseHistoryKeyRow);
    row.historyDateKey = historyKey.dateKey;
    row.historyOccurredAtMs = historyKey.occurredAtMs;
    row.historyFallbackMs = historyKey.fallbackMs;
    this.db.insert(expenses).values(row).run();
    const created = this.db.select().from(expenses).where(eq(expenses.rowId, row.rowId)).get() as ExpenseRow;
    return { expense: this.toExpense(created), created: true };
  }

  getExpenses(): Expense[] {
    const result = this.db.select().from(expenses)
      .where(and(eq(expenses.userId, this.requireUserId()), isNull(expenses.deletedAt)))
      .all()
      .map((row) => this.toExpense(row));
    return sortExpensesForHistory(result, this.timezone);
  }

  getExpenseHistoryPage(limit = 25, before?: string, query: ExpenseHistoryQuery = {}) {
    const bounded = Math.min(100, Math.max(1, Math.floor(limit)));
    const userId = this.requireUserId();
    this.ensureExpenseHistoryKeys(userId);
    const predicates = [eq(expenses.userId, userId), isNull(expenses.deletedAt)];
    const normalizedQuery = query.q?.trim().toLocaleLowerCase();
    if (normalizedQuery) predicates.push(sql`(lower(coalesce(${expenses.note}, '')) like ${`%${normalizedQuery}%`} OR lower(coalesce(${expenses.captureMessage}, '')) like ${`%${normalizedQuery}%`})`);
    if (query.from) predicates.push(sql`${expenses.historyDateKey} >= ${query.from}`);
    if (query.to) predicates.push(sql`${expenses.historyDateKey} <= ${query.to}`);
    if (query.categoryId) predicates.push(eq(expenses.categoryId, query.categoryId));
    if (query.paymentMethodId) predicates.push(eq(expenses.paymentMethodId, query.paymentMethodId));
    if (query.reviewStatus) predicates.push(eq(expenses.reviewStatus, query.reviewStatus));
    if (query.tagId) {
      const taggedRows = this.db.select({ rowId: expenseRecordTags.expenseRowId }).from(expenseRecordTags).where(eq(expenseRecordTags.tagId, query.tagId)).all();
      const rowIds = taggedRows.map((row) => row.rowId);
      predicates.push(rowIds.length > 0 ? inArray(expenses.rowId, rowIds) : sql`1 = 0`);
    }
    let cursor = null;
    if (before) {
      cursor = decodeExpenseHistoryCursor(before);
      if (!cursor) throw new ApplicationError("REQUEST_INVALID", "开销历史游标无效");
      predicates.push(sql`(
        ${expenses.historyDateKey} < ${cursor.dateKey}
        OR (${expenses.historyDateKey} = ${cursor.dateKey} AND ${expenses.historyOccurredAtMs} < ${cursor.occurredAtMs})
        OR (${expenses.historyDateKey} = ${cursor.dateKey} AND ${expenses.historyOccurredAtMs} = ${cursor.occurredAtMs} AND ${expenses.historyFallbackMs} < ${cursor.fallbackMs})
        OR (${expenses.historyDateKey} = ${cursor.dateKey} AND ${expenses.historyOccurredAtMs} = ${cursor.occurredAtMs} AND ${expenses.historyFallbackMs} = ${cursor.fallbackMs} AND ${expenses.id} > ${cursor.id})
      )`);
    }
    const result = this.db.transaction((tx) => {
      const dataRevision = String(
        tx.select({ value: expenseHistoryRevisions.revision })
          .from(expenseHistoryRevisions)
          .where(eq(expenseHistoryRevisions.userId, userId))
          .get()?.value ?? 0,
      );
      const revision = `${dataRevision}:${JSON.stringify({
        q: normalizedQuery ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        categoryId: query.categoryId ?? null,
        paymentMethodId: query.paymentMethodId ?? null,
        tagId: query.tagId ?? null,
        reviewStatus: query.reviewStatus ?? null,
      })}`;
      if (cursor && cursor.revision !== revision) {
        throw new ApplicationError("EXPENSE_HISTORY_STALE", "开销历史已更新，请重新加载");
      }
      const rows = tx.select().from(expenses)
        .where(and(...predicates))
        .orderBy(
          desc(expenses.historyDateKey),
          desc(expenses.historyOccurredAtMs),
          desc(expenses.historyFallbackMs),
          asc(expenses.id),
        )
        .limit(bounded + 1)
        .all() as ExpenseRow[];
      return { revision, rows };
    });
    const pageRows = result.rows.slice(0, bounded);
    const items = this.toExpenses(pageRows);
    const hasMore = result.rows.length > bounded;
    return {
      items,
      hasMore,
      nextCursor: hasMore
        ? createExpenseHistoryCursor(items[items.length - 1]!, this.timezone, result.revision)
        : null,
    };
  }

  getInboxExpenses(): Expense[] {
    const result = this.db.select().from(expenses)
      .where(and(
        eq(expenses.userId, this.requireUserId()),
        eq(expenses.reviewStatus, "pending"),
        isNull(expenses.deletedAt)
      ))
      .orderBy(desc(expenses.recordedAt))
      .all()
      .map((row) => this.toExpense(row));
    return result;
  }

  getExpenseById(id: string, options: { includeDeleted?: boolean } = {}): Expense | undefined {
    try {
      return this.toExpense(this.getOwnedExpenseRow(id, options.includeDeleted ?? false));
    } catch (error) {
      if (error instanceof ApplicationError && error.code === "EXPENSE_NOT_FOUND") return undefined;
      throw error;
    }
  }

  updateExpense(id: string, input: UpdateExpenseInput): Expense {
    const current = this.getOwnedExpenseRow(id, false);
    if (input.amountCents !== undefined) assertPositiveInteger(input.amountCents, "金额必须为正整数分");
    if (input.occurredAt !== undefined && input.occurredOn !== undefined && input.occurredAt !== null && input.occurredOn !== null) {
      throw new ApplicationError("REQUEST_INVALID", "发生时间和发生日期只能提供一个");
    }
    if (input.occurredAt !== undefined && input.occurredAt !== null) assertDateTime(input.occurredAt, "发生时间无效");
    if (input.occurredOn !== undefined && input.occurredOn !== null) assertDateKey(input.occurredOn, "发生日期无效");
    const nextAmountCents = input.amountCents ?? current.amountCents;
    const nextPrecision = input.occurrencePrecision
      ?? (input.occurredOn !== undefined ? "date" : input.occurredAt !== undefined ? "datetime" : current.occurrencePrecision);
    const nextOccurredAt = input.occurredAt !== undefined ? input.occurredAt : input.occurredOn !== undefined ? null : current.occurredAt;
    const nextOccurredOn = input.occurredOn !== undefined ? input.occurredOn : input.occurredAt !== undefined ? null : current.occurredOn;
    if (nextPrecision === "datetime" && (!nextOccurredAt || nextOccurredOn !== null)) {
      throw new ApplicationError("REQUEST_INVALID", "日期时间精度必须提供发生时间");
    }
    if (nextPrecision === "date" && (!nextOccurredOn || nextOccurredAt !== null)) {
      throw new ApplicationError("REQUEST_INVALID", "日期精度必须提供发生日期");
    }
    if (input.categoryId !== undefined && input.categoryId !== null) this.getOwnedExpenseCategory(input.categoryId);
    if (input.paymentMethodId !== undefined && input.paymentMethodId !== null) this.getOwnedPaymentMethod(input.paymentMethodId);
    const tagIds = input.tagIds === undefined ? undefined : [...new Set(input.tagIds)];
    tagIds?.forEach((tagId) => this.getOwnedExpenseTag(tagId));
    if (input.recoverableCents !== undefined) {
      if (!Number.isSafeInteger(input.recoverableCents) || input.recoverableCents < 0 || input.recoverableCents > nextAmountCents) {
        throw new ApplicationError("REQUEST_INVALID", "预计可收回金额必须是介于零和开销金额之间的整数分");
      }
    }
    if (input.recoverableCents === undefined && current.recoverableCents > nextAmountCents) {
      throw new ApplicationError("REQUEST_INVALID", "新的金额不能低于预计可收回金额");
    }

    const updatedAt = nowIso(this.clock);
    const historyKey = this.historyKey({
      ...current,
      occurredAt: nextOccurredAt,
      occurredOn: nextOccurredOn,
      occurrencePrecision: nextPrecision,
      updatedAt,
    });
    this.db.transaction((tx) => {
      tx.update(expenses).set({
        amountCents: input.amountCents,
        occurredAt: nextOccurredAt,
        occurredOn: nextOccurredOn,
        occurrencePrecision: nextPrecision,
        note: input.note === undefined ? undefined : normalizeOptionalText(input.note),
        categoryId: input.categoryId,
        paymentMethodId: input.paymentMethodId,
        reviewStatus: input.reviewStatus,
        recoverableCents: input.recoverableCents,
        settled: input.settled,
        updatedAt,
        historyDateKey: historyKey.dateKey,
        historyOccurredAtMs: historyKey.occurredAtMs,
        historyFallbackMs: historyKey.fallbackMs,
      }).where(and(eq(expenses.rowId, current.rowId), eq(expenses.userId, this.requireUserId()), isNull(expenses.deletedAt))).run();
      if (tagIds !== undefined) {
        tx.delete(expenseRecordTags).where(eq(expenseRecordTags.expenseRowId, current.rowId)).run();
        if (tagIds.length > 0) {
          tx.insert(expenseRecordTags).values(tagIds.map((tagId) => ({
            id: randomUUID(),
            expenseRowId: current.rowId,
            tagId,
            createdAt: updatedAt,
          }))).run();
        }
      }
    });
    const result = this.getExpenseById(id) as Expense;
    return result;
  }

  deleteExpense(id: string): void {
    const current = this.getOwnedExpenseRow(id, false);
    const deletedAt = nowIso(this.clock);
    this.db.update(expenses).set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(expenses.rowId, current.rowId), eq(expenses.userId, this.requireUserId()), isNull(expenses.deletedAt)))
      .run();
  }

  getCapabilities(): Capabilities {
    const mode = process.env.REGISTRATION_MODE ?? "first-user";
    const count = this.db.select({ count: sql<number>`count(*)` }).from(users).get()?.count ?? 0;
    if (mode !== "first-user" && mode !== "open" && mode !== "closed") {
      throw new Error(`Invalid REGISTRATION_MODE: ${mode}`);
    }
    return {
      registration: { available: mode === "open" || (mode === "first-user" && count === 0) },
      effectiveTimezone: this.timezone,
      features: { weather: false, quotation: true, icsImport: true },
    };
  }

  getSession(): AuthSession { return { user: this.getUser() }; }
  getUser(): UserProfile | null {
    const userId = this.requireUserId();
    const row = this.db.select().from(users).where(eq(users.id, userId)).get();
    return this.toUser(row!);
  }

  register(input: RegisterInput): AuthSession {
    if (!this.getCapabilities().registration.available) {
      throw new ApplicationError("REGISTRATION_CLOSED", "当前实例不允许注册");
    }
    const username = input.username.trim();
    if (input.password !== input.passwordConfirmation) {
      throw new ApplicationError("PASSWORD_MISMATCH", "两次输入的密码不一致");
    }
    if (input.password.length < 6) {
      throw new ApplicationError("PASSWORD_TOO_WEAK", "密码至少需要 6 个字符");
    }
    if (!username) throw new ApplicationError("INVALID_CREDENTIALS", "账号不能为空");
    if (this.db.select().from(users).where(eq(users.username, username)).get()) {
      throw new ApplicationError("USERNAME_TAKEN", "该账号已被使用");
    }
    const createdAt = nowIso(this.clock);
    const userId = randomUUID();
    this.db.run(sql`insert into ${users} (id, username, password_hash, created_at, updated_at) values (${userId}, ${username}, ${hashPassword(input.password)}, ${createdAt}, ${createdAt})`);
    this.userId = userId;
    return this.getSession();
  }

  login(input: LoginInput): AuthSession {
    const row = this.db
      .select()
      .from(users)
      .where(eq(users.username, input.username.trim()))
      .get() as (typeof users.$inferSelect & { passwordHash?: string | null }) | undefined;
    if (!row || !row.passwordHash || !verifyPassword(input.password, row.passwordHash)) {
      throw new ApplicationError("INVALID_CREDENTIALS", "账号或密码不正确");
    }
    this.userId = row.id;
    return this.getSession();
  }

  logout() { this.userId = null; }

  updateUserProfile(nickname: string | null, email: string | null): UserProfile {
    const userId = this.requireUserId();
    const updatedAt = nowIso(this.clock);
    this.db.update(users).set({ nickname: normalizeOptionalText(nickname), profileEmail: normalizeOptionalText(email), updatedAt }).where(eq(users.id, userId)).run();
    return this.getUser() as UserProfile;
  }

  getEntries(): Entry[] {
    const userId = this.requireUserId();
    const rows = this.db.select().from(entries).where(and(eq(entries.userId, userId), isNull(entries.deletedAt))).orderBy(asc(entries.sortKey)).all();
    return this.toEntries(rows, this.getDirectFocusSecondsByEntry(userId));
  }

  getEntryById(id: string): Entry | undefined {
    try {
      const row = this.getOwnedEntryRow(id);
      return this.toEntry(row);
    } catch (error) {
      if (error instanceof ApplicationError && error.code === "ENTRY_NOT_FOUND") return undefined;
      throw error;
    }
  }

  addEntry(input: AddEntryInput): Entry {
    const userId = this.requireUserId();
    if (!input.title.trim()) throw new ApplicationError("ENTRY_NOT_FOUND", "条目标题不能为空");
    if (input.parentId) this.getOwnedEntryRow(input.parentId, false);
    const createdAt = nowIso(this.clock);
    const row: typeof entries.$inferInsert = {
      id: randomUUID(),
      userId,
      parentId: input.parentId ?? null,
      title: input.title.trim(),
      description: input.description ?? null,
      completionMode: input.completionMode,
      status: "active",
      dueAt: input.dueAt ?? null,
      sortKey: `z_${createdAt}_${randomUUID().slice(0, 8)}`,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    this.db.insert(entries).values(row).run();
    return this.getEntryById(row.id) as Entry;
  }

  updateEntry(id: string, updates: UpdateEntryInput): Entry {
    const current = this.getOwnedEntryRow(id, false);
    const candidate = { ...this.toEntry(current), ...updates };
    assertEntryStatusIsValid(candidate, candidate.status);
    if (updates.parentId !== undefined && updates.parentId !== current.parentId) {
      assertEntryMoveIsValid(this.getEntries(), id, updates.parentId);
      if (updates.parentId) this.getOwnedEntryRow(updates.parentId, false);
    }
    const updatedAt = nowIso(this.clock);
    const values: Partial<typeof entries.$inferInsert> = {
      parentId: updates.parentId,
      title: updates.title?.trim(),
      description: updates.description,
      completionMode: updates.completionMode,
      status: updates.status,
      dueAt: updates.dueAt,
      sortKey: updates.sortKey,
      updatedAt,
    };
    this.db.update(entries).set(values).where(and(eq(entries.id, id), eq(entries.userId, this.requireUserId()))).run();
    return this.getEntryById(id) as Entry;
  }

  moveEntry(id: string, parentId: string | null): Entry {
    assertEntryMoveIsValid(this.getEntries(), id, parentId);
    return this.updateEntry(id, { parentId });
  }

  deleteEntry(id: string): void {
    const target = this.getOwnedEntryRow(id, false);
    const rows = this.db.select().from(entries).where(eq(entries.userId, this.requireUserId())).all();
    const deleted = new Set<string>();
    const collect = (entryId: string) => {
      if (deleted.has(entryId)) return;
      deleted.add(entryId);
      rows.filter((row) => row.parentId === entryId).forEach((row) => collect(row.id));
    };
    collect(target.id);
    const deletedAt = nowIso(this.clock);
    this.db.transaction((tx) => {
      for (const row of rows.filter((candidate) => deleted.has(candidate.id))) {
        tx.update(entries).set({
          title: row.title.startsWith("[已删除] ") ? row.title : `[已删除] ${row.title}`,
          description: null,
          parentId: null,
          status: "archived",
          deletedAt,
          updatedAt: deletedAt,
        }).where(eq(entries.id, row.id)).run();
        tx.delete(weekPlanEntries).where(eq(weekPlanEntries.entryId, row.id)).run();
      }
    });
  }

  private ensureWeekPlan(weekStart?: string) {
    const userId = this.requireUserId();
    const normalized = weekStart ?? mondayOf(localDateKey(this.clock(), this.timezone));
    assertValidWeekStart(normalized);
    const existing = this.db.select().from(weekPlans).where(and(eq(weekPlans.userId, userId), eq(weekPlans.weekStart, normalized))).get();
    if (existing) return existing;
    const createdAt = nowIso(this.clock);
    const plan = { id: randomUUID(), userId, weekStart: normalized, note: "", createdAt, updatedAt: createdAt };
    this.db.transaction((tx) => {
      const previousWeek = shiftDateKey(normalized, -7);
      const previous = tx.select().from(weekPlans).where(and(eq(weekPlans.userId, userId), eq(weekPlans.weekStart, previousWeek))).get();
      tx.insert(weekPlans).values({
        ...plan,
        note: previous?.note ?? "",
      }).run();
      if (!previous) return;
      const previousItems = tx.select().from(weekPlanEntries).where(eq(weekPlanEntries.weekPlanId, previous.id)).all();
      const ownedEntries = tx.select().from(entries).where(eq(entries.userId, userId)).all();
      for (const item of previousItems) {
        const entry = ownedEntries.find((candidate) => candidate.id === item.entryId);
        if (!entry || entry.deletedAt !== null || entry.status !== "active") continue;
        tx.insert(weekPlanEntries).values({
          id: randomUUID(),
          weekPlanId: plan.id,
          entryId: entry.id,
          source: "rollover",
          role: item.role,
          plannedFocusSeconds: item.plannedFocusSeconds,
          sortKey: item.sortKey,
        }).onConflictDoNothing().run();
      }
    });
    return this.db.select().from(weekPlans).where(eq(weekPlans.id, plan.id)).get() as typeof weekPlans.$inferSelect;
  }

  getWeekPlan(weekStart?: string): WeekPlan {
    const plan = this.ensureWeekPlan(weekStart);
    return this.weekPlanFromRow(plan);
  }

  getExistingWeekPlan(weekStart: string): WeekPlan | null {
    assertValidWeekStart(weekStart);
    const userId = this.requireUserId();
    const plan = this.db.select().from(weekPlans).where(and(eq(weekPlans.userId, userId), eq(weekPlans.weekStart, weekStart))).get();
    return plan ? this.weekPlanFromRow(plan) : null;
  }

  private weekPlanFromRow(plan: typeof weekPlans.$inferSelect): WeekPlan {
    const items = this.db.select().from(weekPlanEntries).where(eq(weekPlanEntries.weekPlanId, plan.id)).orderBy(asc(weekPlanEntries.sortKey)).all();
    return {
      weekStart: plan.weekStart,
      note: plan.note,
      items: items.map((item): WeekPlanItem => ({
        entryId: item.entryId,
        source: item.source,
        role: item.role,
        plannedFocusSeconds: item.plannedFocusSeconds,
        sortKey: item.sortKey,
      })),
    };
  }

  updateWeekPlanNote(note: string, weekStart?: string): void {
    const plan = this.ensureWeekPlan(weekStart);
    this.db.update(weekPlans).set({ note, updatedAt: nowIso(this.clock) }).where(eq(weekPlans.id, plan.id)).run();
  }

  addToWeekPlan(entryId: string, weekStart?: string, input?: Partial<WeekPlanItemInput>): void {
    const entry = this.getOwnedEntryRow(entryId, false);
    const plan = this.ensureWeekPlan(weekStart);
    const role = input?.role ?? (entry.completionMode === "ongoing" ? "focus" : "commitment");
    const plannedFocusSeconds = input?.plannedFocusSeconds ?? null;
    assertValidWeekPlanItemInput({ role, plannedFocusSeconds });
    this.db.insert(weekPlanEntries).values({
      id: randomUUID(),
      weekPlanId: plan.id,
      entryId,
      source: "manual",
      role,
      plannedFocusSeconds,
      sortKey: `z_${nowIso(this.clock)}_${randomUUID().slice(0, 8)}`,
    }).onConflictDoNothing().run();
  }

  updateWeekPlanItem(entryId: string, input: WeekPlanItemInput, weekStart?: string): void {
    this.getOwnedEntryRow(entryId, false);
    assertValidWeekPlanItemInput(input);
    const userId = this.requireUserId();
    const normalized = weekStart ?? mondayOf(localDateKey(this.clock(), this.timezone));
    assertValidWeekStart(normalized);
    const plan = this.db.select().from(weekPlans)
      .where(and(eq(weekPlans.userId, userId), eq(weekPlans.weekStart, normalized)))
      .get();
    if (!plan) throw new ApplicationError("WEEK_PLAN_ITEM_NOT_FOUND", "该周计划不存在");
    const result = this.db.update(weekPlanEntries).set({
      role: input.role,
      plannedFocusSeconds: input.plannedFocusSeconds,
    }).where(and(eq(weekPlanEntries.weekPlanId, plan.id), eq(weekPlanEntries.entryId, entryId))).run();
    if (result.changes === 0) throw new ApplicationError("WEEK_PLAN_ITEM_NOT_FOUND", "条目不在该周计划中");
  }

  removeFromWeekPlan(entryId: string, weekStart?: string): void {
    const plan = this.ensureWeekPlan(weekStart);
    this.db.delete(weekPlanEntries).where(and(eq(weekPlanEntries.weekPlanId, plan.id), eq(weekPlanEntries.entryId, entryId))).run();
  }

  getActiveFocus(): FocusSession | null {
    const userId = this.requireUserId();
    const row = this.db.select().from(focusSessions).where(and(eq(focusSessions.userId, userId), isNull(focusSessions.endedAt))).get();
    return row ? this.toFocusSession(row) : null;
  }

  getFocusSessions(): FocusSession[] {
    const rows = this.db.select().from(focusSessions).where(eq(focusSessions.userId, this.requireUserId())).orderBy(desc(focusSessions.startedAt)).all();
    return rows.map((row) => this.toFocusSession(row));
  }

  startFocusSession(entryId?: string | null): FocusSession {
    const userId = this.requireUserId();
    if (this.getActiveFocus()) throw new ApplicationError("FOCUS_ALREADY_ACTIVE", "已有活动中的专注会话");
    if (entryId) this.getOwnedEntryRow(entryId, false);
    const startedAt = nowIso(this.clock);
    const session: typeof focusSessions.$inferInsert = {
      id: randomUUID(), userId, startedAt, endedAt: null, captureMode: "timer", note: null, outcome: null, createdAt: startedAt, updatedAt: startedAt,
    };
    this.db.transaction((tx) => {
      tx.insert(focusSessions).values(session).run();
      if (entryId) tx.insert(focusSegments).values({ id: randomUUID(), sessionId: session.id, startedAt, endedAt: startedAt, entryId, note: null }).run();
    });
    return this.toFocusSession(this.db.select().from(focusSessions).where(eq(focusSessions.id, session.id)).get() as FocusSessionRow);
  }

  stopFocusSession(sessionId: string, outcome: string | null, note: string | null, submittedSegments: FocusSegment[]): FocusSession {
    const userId = this.requireUserId();
    const sessionRow = this.db.select().from(focusSessions).where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId))).get();
    if (!sessionRow || sessionRow.endedAt) throw new ApplicationError("FOCUS_NOT_FOUND", "活动专注会话不存在");
    const endedAt = nowIso(this.clock);
    let segments = submittedSegments.length > 0 ? submittedSegments.map((segment) => ({ ...segment })) : [];
    if (segments.length === 0) {
      const existing = this.db.select().from(focusSegments).where(eq(focusSegments.sessionId, sessionId)).orderBy(asc(focusSegments.startedAt)).all()[0];
      segments = [{ id: randomUUID(), startedAt: sessionRow.startedAt, endedAt, entryId: existing?.entryId ?? null, note: note ?? null }];
    } else {
      segments[segments.length - 1] = { ...segments[segments.length - 1], endedAt };
    }
    for (const segment of segments) {
      if (segment.entryId) this.getOwnedEntryRow(segment.entryId, false);
    }
    assertSegmentsPartitionSession({ startedAt: sessionRow.startedAt, endedAt }, segments);
    assertNoFocusOverlap(this.getFocusSessions(), sessionRow.startedAt, endedAt, sessionId);
    const updatedAt = nowIso(this.clock);
    this.db.transaction((tx) => {
      tx.update(focusSessions).set({ endedAt, outcome, note, updatedAt }).where(eq(focusSessions.id, sessionId)).run();
      tx.delete(focusSegments).where(eq(focusSegments.sessionId, sessionId)).run();
      tx.insert(focusSegments).values(segments.map((segment) => ({ id: randomUUID(), sessionId, startedAt: segment.startedAt, endedAt: segment.endedAt, entryId: segment.entryId, note: segment.note }))).run();
    });
    return this.toFocusSession(this.db.select().from(focusSessions).where(eq(focusSessions.id, sessionId)).get() as FocusSessionRow);
  }

  updateFocusSession(sessionId: string, segments: FocusSegment[]): FocusSession {
    const userId = this.requireUserId();
    const session = this.db.select().from(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)))
      .get();
    if (!session || !session.endedAt) throw new ApplicationError("FOCUS_NOT_FOUND", "已结束的专注会话不存在");
    for (const segment of segments) {
      if (segment.entryId) this.getOwnedEntryRow(segment.entryId, false);
    }
    assertSegmentsPartitionSession({ startedAt: session.startedAt, endedAt: session.endedAt }, segments);
    const updatedAt = nowIso(this.clock);
    this.db.transaction((tx) => {
      tx.delete(focusSegments).where(eq(focusSegments.sessionId, sessionId)).run();
      tx.insert(focusSegments).values(segments.map((segment) => ({
        id: randomUUID(),
        sessionId,
        startedAt: segment.startedAt,
        endedAt: segment.endedAt,
        entryId: segment.entryId,
        note: segment.note,
      }))).run();
      tx.update(focusSessions).set({ updatedAt }).where(eq(focusSessions.id, sessionId)).run();
    });
    return this.toFocusSession(this.db.select().from(focusSessions).where(eq(focusSessions.id, sessionId)).get() as FocusSessionRow);
  }

  discardFocusSession(): void {
    const userId = this.requireUserId();
    const active = this.db.select({ id: focusSessions.id })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), isNull(focusSessions.endedAt)))
      .get();
    if (!active) throw new ApplicationError("FOCUS_NOT_FOUND", "活动专注会话不存在");

    this.db.delete(focusSessions).where(and(eq(focusSessions.id, active.id), eq(focusSessions.userId, userId))).run();
  }

  addManualFocusSession(input: ManualFocusInput): FocusSession {
    const userId = this.requireUserId();
    assertPositiveRange(input.startedAt, input.endedAt);
    if (input.entryId) this.getOwnedEntryRow(input.entryId, false);
    assertNoFocusOverlap(this.getFocusSessions(), input.startedAt, input.endedAt);
    const createdAt = nowIso(this.clock);
    const session: typeof focusSessions.$inferInsert = { id: randomUUID(), userId, startedAt: input.startedAt, endedAt: input.endedAt, captureMode: "manual", note: input.note, outcome: input.outcome, createdAt, updatedAt: createdAt };
    this.db.transaction((tx) => {
      tx.insert(focusSessions).values(session).run();
      tx.insert(focusSegments).values({ id: randomUUID(), sessionId: session.id, startedAt: input.startedAt, endedAt: input.endedAt, entryId: input.entryId, note: input.note }).run();
    });
    return this.toFocusSession(this.db.select().from(focusSessions).where(eq(focusSessions.id, session.id)).get() as FocusSessionRow);
  }

  getScheduleBlocks(): ScheduleBlock[] {
    return this.db.select().from(scheduleBlocks).where(eq(scheduleBlocks.userId, this.requireUserId())).orderBy(asc(scheduleBlocks.startedAt)).all().map((row) => this.toSchedule(row));
  }

  private expandScheduleForRange(block: ScheduleBlock, from: string, to: string): ScheduleBlock[] {
    if (!block.recurrence) {
      return parseDate(block.startedAt) < parseDate(to) && parseDate(block.endedAt) > parseDate(from) ? [block] : [];
    }

    const startDate = localDateKey(new Date(block.startedAt), this.timezone);
    const fromDate = localDateKey(new Date(from), this.timezone);
    const toDate = localDateKey(new Date(to), this.timezone);
    const startParts = getParts(new Date(block.startedAt), this.timezone);
    const durationMs = parseDate(block.endedAt) - parseDate(block.startedAt);
    // Include the previous local date so an overnight instance can overlap the range start.
    const firstDate = daysBetween(startDate, fromDate) > 0
      ? shiftDateKey(fromDate, -1)
      : startDate;
    const lastDate = daysBetween(startDate, toDate) > 0 ? toDate : startDate;
    const instances: ScheduleBlock[] = [];

    for (let offset = 0; offset <= daysBetween(firstDate, lastDate); offset += 1) {
      const dateKey = shiftDateKey(firstDate, offset);
      const elapsedDays = daysBetween(startDate, dateKey);
      if (elapsedDays < 0) continue;
      const weekIndex = Math.floor(elapsedDays / 7);
      if (weekIndex % block.recurrence.interval !== 0 || !block.recurrence.weekdays.includes(weekdayFor(dateKey))) continue;
      if (block.recurrence.until && dateKey > block.recurrence.until.slice(0, 10)) continue;

      const startedAt = zonedDateTime(dateKey, startParts.hour, startParts.minute, startParts.second, this.timezone);
      const endedAt = new Date(startedAt.getTime() + durationMs);
      if (startedAt.getTime() < parseDate(to) && endedAt.getTime() > parseDate(from)) {
        instances.push({
          ...block,
          id: `${block.id}::${dateKey}`,
          recurrenceSourceId: block.id,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
        });
      }
    }
    return instances;
  }

  getCalendarPayload(from?: string, to?: string) {
    if (!from || !to) {
      return { scheduleBlocks: this.getScheduleBlocks(), focusSessions: this.getFocusSessions() };
    }
    assertPositiveRange(from, to);
    const fromMs = parseDate(from);
    const toMs = parseDate(to);
    const overlaps = (startedAt: string, endedAt: string | null) =>
      parseDate(startedAt) < toMs && parseDate(endedAt ?? nowIso(this.clock)) > fromMs;
    return {
      scheduleBlocks: this.getScheduleBlocks().flatMap((block) => this.expandScheduleForRange(block, from, to)),
      focusSessions: this.getFocusSessions().filter((session) => overlaps(session.startedAt, session.endedAt)),
    };
  }

  addScheduleBlock(input: ScheduleBlockInput): ScheduleBlock {
    const userId = this.requireUserId();
    assertPositiveRange(input.startedAt, input.endedAt);
    const createdAt = nowIso(this.clock);
    const row: typeof scheduleBlocks.$inferInsert = { id: randomUUID(), userId, kind: input.kind, title: input.title.trim(), description: normalizeOptionalText(input.description), startedAt: input.startedAt, endedAt: input.endedAt, location: input.location ?? null, colorKey: input.colorKey ?? "blue", recurrenceJson: input.recurrence ? JSON.stringify(input.recurrence) : null, source: "manual", importId: null, sourceUid: null, createdAt, updatedAt: createdAt };
    this.db.insert(scheduleBlocks).values(row).run();
    return this.toSchedule(this.db.select().from(scheduleBlocks).where(eq(scheduleBlocks.id, row.id)).get() as ScheduleRow);
  }

  updateScheduleBlock(id: string, input: UpdateScheduleBlockInput): ScheduleBlock {
    const baseId = id.split("::", 1)[0]!;
    const current = this.db.select().from(scheduleBlocks).where(and(eq(scheduleBlocks.id, baseId), eq(scheduleBlocks.userId, this.requireUserId()))).get();
    if (!current) throw new ApplicationError("SCHEDULE_NOT_FOUND", "日程不存在");
    const next = {
      kind: input.kind ?? current.kind,
      title: input.title === undefined ? current.title : input.title.trim(),
      description: input.description === undefined ? current.description : normalizeOptionalText(input.description),
      startedAt: input.startedAt ?? current.startedAt,
      endedAt: input.endedAt ?? current.endedAt,
      location: input.location === undefined ? current.location : normalizeOptionalText(input.location),
      colorKey: input.colorKey === undefined ? current.colorKey : input.colorKey ?? "blue",
      recurrenceJson: input.recurrence === undefined
        ? current.recurrenceJson
        : input.recurrence ? JSON.stringify(input.recurrence) : null,
    };
    if (!next.title) throw new ApplicationError("REQUEST_INVALID", "日程标题不能为空");
    assertPositiveRange(next.startedAt, next.endedAt);
    this.db.update(scheduleBlocks).set({ ...next, updatedAt: nowIso(this.clock) }).where(eq(scheduleBlocks.id, current.id)).run();
    return this.toSchedule(this.db.select().from(scheduleBlocks).where(eq(scheduleBlocks.id, current.id)).get() as ScheduleRow);
  }

  deleteScheduleBlock(id: string): void {
    const baseId = id.split("::", 1)[0]!;
    const result = this.db.delete(scheduleBlocks).where(and(eq(scheduleBlocks.id, baseId), eq(scheduleBlocks.userId, this.requireUserId()))).run();
    if (result.changes === 0) throw new ApplicationError("SCHEDULE_NOT_FOUND", "日程不存在");
  }

  importIcsScheduleBlocks(
    blocks: ScheduleBlockInput[],
    fileName = "导入日程.ics",
    options?: {
      sourceKey?: string;
      sourceName?: string;
      syncWindow?: { from: string; to: string };
      removedSourceUids?: string[];
      preserveSourceUids?: string[];
    },
  ): number {
    const userId = this.requireUserId();
    const createdAt = nowIso(this.clock);
    const sourceKey = options?.sourceKey?.trim();

    // Preserve the original one-shot import behavior for old callers and legacy rows.
    if (!sourceKey) {
      const existingSourceUids = new Set(
        this.db.select({ sourceUid: scheduleBlocks.sourceUid })
          .from(scheduleBlocks)
          .where(eq(scheduleBlocks.userId, userId))
          .all()
          .map((row) => row.sourceUid)
          .filter((sourceUid): sourceUid is string => Boolean(sourceUid))
      );
      const newBlocks = blocks.filter((block) => !block.sourceUid || !existingSourceUids.has(block.sourceUid));
      if (newBlocks.length === 0) return 0;
      const importId = randomUUID();
      this.db.transaction((tx) => {
        tx.insert(scheduleImports).values({ id: importId, userId, fileName: fileName.trim() || "导入日程.ics", createdAt, updatedAt: createdAt, changeCount: newBlocks.length }).run();
        tx.insert(scheduleBlocks).values(newBlocks.map((block) => ({
          id: randomUUID(),
          userId,
          kind: block.kind,
          title: block.title.trim(),
          description: normalizeOptionalText(block.description),
          startedAt: block.startedAt,
          endedAt: block.endedAt,
          location: normalizeOptionalText(block.location),
          colorKey: block.colorKey ?? "purple",
          recurrenceJson: null,
          source: "ics" as const,
          importId,
          sourceUid: block.sourceUid ?? null,
          sourceInstanceKey: block.sourceInstanceKey ?? null,
          createdAt,
          updatedAt: createdAt,
        }))).run();
      });
      return newBlocks.length;
    }

    const currentImport = this.db.select().from(scheduleImports)
      .where(and(eq(scheduleImports.userId, userId), eq(scheduleImports.sourceKey, sourceKey))).get()
      ?? this.db.select().from(scheduleImports)
        .where(and(eq(scheduleImports.userId, userId), isNull(scheduleImports.sourceKey), eq(scheduleImports.fileName, fileName))).get();
    const importId = currentImport?.id ?? randomUUID();
    const desired = new Map<string, ScheduleBlockInput>();
    blocks.forEach((block) => {
      const key = block.sourceInstanceKey ?? `${block.sourceUid ?? "event"}:${block.startedAt}`;
      desired.set(key, block);
    });
    const existing = currentImport
      ? this.db.select().from(scheduleBlocks).where(eq(scheduleBlocks.importId, currentImport.id)).all()
      : [];
    let changed = 0;
    this.db.transaction((tx) => {
      if (!currentImport) {
        tx.insert(scheduleImports).values({
          id: importId,
          userId,
          fileName: fileName.trim() || "导入日程.ics",
          sourceKey,
          sourceName: options?.sourceName?.trim() || fileName.trim() || "导入日程",
          createdAt,
          updatedAt: createdAt,
          changeCount: 0,
        }).run();
      }
      const existingByKey = new Map(existing.map((row) => [
        row.sourceInstanceKey ?? `${row.sourceUid ?? "event"}:${row.startedAt}`,
        row,
      ]));
      for (const [key, block] of desired) {
        const row = existingByKey.get(key);
        const normalized = {
          kind: block.kind,
          title: block.title.trim(),
          description: normalizeOptionalText(block.description),
          startedAt: block.startedAt,
          endedAt: block.endedAt,
          location: normalizeOptionalText(block.location),
          colorKey: block.colorKey ?? "purple",
          sourceUid: block.sourceUid ?? null,
          sourceInstanceKey: block.sourceInstanceKey ?? key,
          updatedAt: createdAt,
        };
        if (!row) {
          tx.insert(scheduleBlocks).values({
            id: randomUUID(),
            userId,
            ...normalized,
            recurrenceJson: null,
            source: "ics" as const,
            importId,
            createdAt,
          }).run();
          changed += 1;
          continue;
        }
        const same = row.kind === normalized.kind
          && row.title === normalized.title
          && row.description === normalized.description
          && row.startedAt === normalized.startedAt
          && row.endedAt === normalized.endedAt
          && row.location === normalized.location
          && row.colorKey === normalized.colorKey
          && row.sourceUid === normalized.sourceUid;
        if (!same) {
          tx.update(scheduleBlocks).set(normalized).where(eq(scheduleBlocks.id, row.id)).run();
          changed += 1;
        }
      }
      const window = options?.syncWindow;
      const preservedUids = new Set(options?.preserveSourceUids ?? []);
      for (const row of existing) {
        const key = row.sourceInstanceKey ?? `${row.sourceUid ?? "event"}:${row.startedAt}`;
        const inWindow = Boolean(window)
          && parseDate(row.startedAt) >= parseDate(window!.from)
          && parseDate(row.startedAt) < parseDate(window!.to);
        const removed = !desired.has(key) && inWindow && !preservedUids.has(row.sourceUid ?? "");
        if (removed) {
          tx.delete(scheduleBlocks).where(eq(scheduleBlocks.id, row.id)).run();
          changed += 1;
        }
      }
      tx.update(scheduleImports).set({
        fileName: fileName.trim() || currentImport?.fileName || "导入日程.ics",
        sourceKey,
        sourceName: options?.sourceName?.trim() || currentImport?.sourceName || fileName.trim() || "导入日程",
        updatedAt: createdAt,
        changeCount: changed,
      }).where(and(eq(scheduleImports.id, importId), eq(scheduleImports.userId, userId))).run();
    });
    return changed;
  }

  getScheduleImports(): ScheduleImport[] {
    const userId = this.requireUserId();
    return this.db.select().from(scheduleImports)
      .where(eq(scheduleImports.userId, userId))
      .orderBy(desc(scheduleImports.createdAt)).all()
      .map((row) => ({
        id: row.id,
        fileName: row.fileName,
        importedAt: row.updatedAt ?? row.createdAt,
        blockCount: this.db.select({ count: sql<number>`count(*)` }).from(scheduleBlocks)
          .where(eq(scheduleBlocks.importId, row.id)).get()?.count ?? 0,
        sourceKey: row.sourceKey,
        sourceName: row.sourceName,
        changeCount: row.changeCount,
      }));
  }

  deleteScheduleImport(id: string): void {
    const userId = this.requireUserId();
    const result = this.db.delete(scheduleImports)
      .where(and(eq(scheduleImports.id, id), eq(scheduleImports.userId, userId))).run();
    if (result.changes === 0) throw new ApplicationError("SCHEDULE_NOT_FOUND", "导入批次不存在");
  }

  private assertTemplateDateRange(fromDate: string, toDate: string) {
    const fromMs = Date.parse(`${fromDate}T00:00:00Z`);
    const toMs = Date.parse(`${toDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
      || !Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
      throw new ApplicationError("REQUEST_INVALID", "模板应用日期范围无效");
    }
    if ((toMs - fromMs) / 86_400_000 > 366) {
      throw new ApplicationError("REQUEST_INVALID", "一次最多应用 366 天");
    }
  }

  private getOwnedTemplateRow(id: string) {
    const row = this.db.select().from(scheduleTemplates)
      .where(and(eq(scheduleTemplates.id, id), eq(scheduleTemplates.userId, this.requireUserId())))
      .get();
    if (!row) throw new ApplicationError("SCHEDULE_TEMPLATE_NOT_FOUND", "日程模板不存在");
    return row;
  }

  private toScheduleTemplate(row: ScheduleTemplateRow): ScheduleTemplate {
    const items = this.db.select().from(scheduleTemplateItems)
      .where(eq(scheduleTemplateItems.templateId, row.id))
      .orderBy(asc(scheduleTemplateItems.sortKey)).all();
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      items: items.map((item): ScheduleTemplateItem => ({
        id: item.id,
        weekdays: JSON.parse(item.weekdaysJson) as ScheduleTemplateItem["weekdays"],
        title: item.title,
        description: item.description,
        kind: item.kind,
        location: item.location,
        colorKey: item.colorKey,
        startTime: item.startTime,
        endTime: item.endTime,
        sortKey: item.sortKey,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getScheduleTemplates(): ScheduleTemplate[] {
    return this.db.select().from(scheduleTemplates)
      .where(eq(scheduleTemplates.userId, this.requireUserId()))
      .orderBy(desc(scheduleTemplates.updatedAt)).all()
      .map((row) => this.toScheduleTemplate(row));
  }

  createScheduleTemplate(input: ScheduleTemplateInput): ScheduleTemplate {
    const userId = this.requireUserId();
    const name = input.name.trim();
    if (!name) throw new ApplicationError("REQUEST_INVALID", "模板名称不能为空");
    if (input.items.length === 0) throw new ApplicationError("REQUEST_INVALID", "模板至少需要一个日程项");
    const createdAt = nowIso(this.clock);
    const templateId = randomUUID();
    this.db.transaction((tx) => {
      tx.insert(scheduleTemplates).values({
        id: templateId,
        userId,
        name,
        description: normalizeOptionalText(input.description),
        createdAt,
        updatedAt: createdAt,
      }).run();
      tx.insert(scheduleTemplateItems).values(input.items.map((item, index) => ({
        id: randomUUID(),
        templateId,
        weekdaysJson: JSON.stringify(item.weekdays),
        title: item.title.trim(),
        description: normalizeOptionalText(item.description),
        kind: item.kind,
        location: normalizeOptionalText(item.location),
        colorKey: item.colorKey ?? "blue",
        startTime: item.startTime,
        endTime: item.endTime,
        sortKey: String(index).padStart(4, "0"),
      }))).run();
    });
    return this.toScheduleTemplate(this.db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, templateId)).get() as ScheduleTemplateRow);
  }

  updateScheduleTemplate(id: string, input: ScheduleTemplateInput): ScheduleTemplate {
    const template = this.getOwnedTemplateRow(id);
    const name = input.name.trim();
    if (!name || input.items.length === 0) throw new ApplicationError("REQUEST_INVALID", "模板名称和日程项不能为空");
    const updatedAt = nowIso(this.clock);
    this.db.transaction((tx) => {
      tx.update(scheduleTemplates).set({
        name,
        description: normalizeOptionalText(input.description),
        updatedAt,
      }).where(eq(scheduleTemplates.id, template.id)).run();
      tx.delete(scheduleTemplateItems).where(eq(scheduleTemplateItems.templateId, template.id)).run();
      tx.insert(scheduleTemplateItems).values(input.items.map((item, index) => ({
        id: randomUUID(),
        templateId: template.id,
        weekdaysJson: JSON.stringify(item.weekdays),
        title: item.title.trim(),
        description: normalizeOptionalText(item.description),
        kind: item.kind,
        location: normalizeOptionalText(item.location),
        colorKey: item.colorKey ?? "blue",
        startTime: item.startTime,
        endTime: item.endTime,
        sortKey: String(index).padStart(4, "0"),
      }))).run();
    });
    return this.toScheduleTemplate(this.db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, template.id)).get() as ScheduleTemplateRow);
  }

  deleteScheduleTemplate(id: string): void {
    const template = this.getOwnedTemplateRow(id);
    this.db.delete(scheduleTemplates).where(eq(scheduleTemplates.id, template.id)).run();
  }

  private templateInstances(template: ScheduleTemplate, fromDate: string, toDate: string): ScheduleTemplatePreview["blocks"] {
    this.assertTemplateDateRange(fromDate, toDate);
    const blocks: ScheduleTemplatePreview["blocks"] = [];
    const weekdayForDate = (dateKey: string) => weekdayFor(dateKey);
    for (let offset = 0; offset <= daysBetween(fromDate, toDate); offset += 1) {
      const dateKey = shiftDateKey(fromDate, offset);
      const weekday = weekdayForDate(dateKey);
      for (const item of template.items) {
        if (!item.weekdays.includes(weekday)) continue;
        const [startHour, startMinute] = item.startTime.split(":").map(Number);
        const [endHour, endMinute] = item.endTime.split(":").map(Number);
        const startedAt = zonedDateTime(dateKey, startHour, startMinute, 0, this.timezone);
        const overnight = endHour * 60 + endMinute <= startHour * 60 + startMinute;
        const endedAt = zonedDateTime(overnight ? shiftDateKey(dateKey, 1) : dateKey, endHour, endMinute, 0, this.timezone);
        blocks.push({
          itemId: item.id,
          title: item.title,
          description: item.description,
          kind: item.kind,
          location: item.location,
          colorKey: item.colorKey,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
        });
      }
    }
    return blocks.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.title.localeCompare(b.title));
  }

  previewScheduleTemplate(id: string, fromDate: string, toDate: string): ScheduleTemplatePreview {
    const template = this.toScheduleTemplate(this.getOwnedTemplateRow(id));
    return {
      templateId: template.id,
      templateName: template.name,
      fromDate,
      toDate,
      blocks: this.templateInstances(template, fromDate, toDate),
    };
  }

  applyScheduleTemplate(id: string, fromDate: string, toDate: string): ScheduleTemplateApplication {
    const userId = this.requireUserId();
    const template = this.toScheduleTemplate(this.getOwnedTemplateRow(id));
    const blocks = this.templateInstances(template, fromDate, toDate);
    const applicationId = randomUUID();
    const appliedAt = nowIso(this.clock);
    this.db.transaction((tx) => {
      tx.insert(scheduleTemplateApplications).values({
        id: applicationId,
        userId,
        templateId: template.id,
        templateName: template.name,
        fromDate,
        toDate,
        appliedAt,
      }).run();
      tx.insert(scheduleBlocks).values(blocks.map((block) => ({
        id: randomUUID(),
        userId,
        kind: block.kind,
        title: block.title,
        description: block.description,
        startedAt: block.startedAt,
        endedAt: block.endedAt,
        location: block.location,
        colorKey: block.colorKey ?? "blue",
        recurrenceJson: null,
        source: "template" as const,
        importId: null,
        sourceUid: null,
        templateApplicationId: applicationId,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      }))).run();
    });
    return {
      id: applicationId,
      templateId: template.id,
      templateName: template.name,
      fromDate,
      toDate,
      appliedAt,
      blockCount: blocks.length,
    };
  }

  getScheduleTemplateApplications(): ScheduleTemplateApplication[] {
    const userId = this.requireUserId();
    return this.db.select().from(scheduleTemplateApplications)
      .where(eq(scheduleTemplateApplications.userId, userId))
      .orderBy(desc(scheduleTemplateApplications.appliedAt)).all()
      .map((row) => ({
        id: row.id,
        templateId: row.templateId,
        templateName: row.templateName,
        fromDate: row.fromDate,
        toDate: row.toDate,
        appliedAt: row.appliedAt,
        blockCount: this.db.select({ count: sql<number>`count(*)` }).from(scheduleBlocks)
          .where(eq(scheduleBlocks.templateApplicationId, row.id)).get()?.count ?? 0,
      }));
  }

  deleteScheduleTemplateApplication(id: string): void {
    const result = this.db.delete(scheduleTemplateApplications)
      .where(and(eq(scheduleTemplateApplications.id, id), eq(scheduleTemplateApplications.userId, this.requireUserId()))).run();
    if (result.changes === 0) throw new ApplicationError("SCHEDULE_TEMPLATE_APPLICATION_NOT_FOUND", "模板应用批次不存在");
  }

  private rangeForScale(scale: "day" | "week" | "month" = "week", weekStart?: string) {
    if (weekStart && scale !== "week") {
      throw new ApplicationError("REQUEST_INVALID", "weekStart 仅支持周统计");
    }
    const today = localDateKey(this.clock(), this.timezone);
    const startDate = scale === "day" ? today : scale === "week" ? (weekStart ?? mondayOf(today)) : `${today.slice(0, 7)}-01`;
    const dailyCount = scale === "day" ? 1 : scale === "week" ? 7 : Number(shiftDateKey(startDate, 1).slice(8, 10)) === 1 ? 28 : new Date(Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)), 0)).getUTCDate();
    return { startDate, dailyCount };
  }

  getStatisticsPayload(scale: "day" | "week" | "month" = "week", weekStart?: string): StatisticsPayload {
    if (weekStart) assertValidWeekStart(weekStart);
    const { startDate, dailyCount } = this.rangeForScale(scale, weekStart);
    const buckets = Array.from({ length: dailyCount }, (_, index) => {
      const date = shiftDateKey(startDate, index);
      return { date, startMs: zonedMidnight(date, this.timezone), endMs: zonedMidnight(shiftDateKey(date, 1), this.timezone), seconds: 0 };
    });
    const startMs = buckets[0]?.startMs ?? zonedMidnight(startDate, this.timezone);
    const endMs = buckets.at(-1)?.endMs ?? startMs;
    let totalSeconds = 0;
    let unassignedSeconds = 0;
    const direct = new Map<string, number>();
    for (const session of this.getFocusSessions()) {
      if (!session.endedAt) continue;
      for (const segment of session.segments) {
        const overlap = Math.max(0, Math.min(parseDate(segment.endedAt), endMs) - Math.max(parseDate(segment.startedAt), startMs)) / 1000;
        if (overlap <= 0) continue;
        totalSeconds += overlap;
        if (segment.entryId) direct.set(segment.entryId, (direct.get(segment.entryId) ?? 0) + overlap);
        else unassignedSeconds += overlap;
        for (const bucket of buckets) bucket.seconds += Math.max(0, Math.min(parseDate(segment.endedAt), bucket.endMs) - Math.max(parseDate(segment.startedAt), bucket.startMs)) / 1000;
      }
    }
    const allRows = this.db.select().from(entries).where(eq(entries.userId, this.requireUserId())).all();
    const aggregate = (entryId: string): number =>
      (direct.get(entryId) ?? 0) +
      allRows.filter((row) => row.parentId === entryId).reduce((sum, row) => sum + aggregate(row.id), 0);
    const entryBreakdown = allRows.filter(entryStatusIsVisible).map((entry) => ({ entryId: entry.id, directSeconds: direct.get(entry.id) ?? 0, aggregateSeconds: aggregate(entry.id) }));
    const roots = entryBreakdown.filter((entry) => allRows.find((row) => row.id === entry.entryId)?.parentId === null);
    return { totalSeconds, unassignedSeconds, daily: buckets.map(({ date, seconds }) => ({ date, seconds })), entryBreakdown, roots };
  }

  exportUserData(): UserDataExport {
    const userId = this.requireUserId();
    const allEntryRows = this.db
      .select()
      .from(entries)
      .where(eq(entries.userId, userId))
      .orderBy(asc(entries.sortKey))
      .all();
    const plans = this.db
      .select()
      .from(weekPlans)
      .where(eq(weekPlans.userId, userId))
      .orderBy(asc(weekPlans.weekStart))
      .all();

    const entriesForExport = this.toEntries(allEntryRows, this.getDirectFocusSecondsByEntry(userId));
    const expenseRows = this.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(asc(expenses.createdAt), asc(expenses.id))
      .all() as ExpenseRow[];
    return {
      schemaVersion: "1.1",
      exportedAt: nowIso(this.clock),
      effectiveTimezone: this.timezone,
      profile: this.toUser(this.getUserRow()!),
      entries: entriesForExport,
      weekPlans: plans.map((plan) => ({
        weekStart: plan.weekStart,
        note: plan.note,
        items: this.db
          .select()
          .from(weekPlanEntries)
          .where(eq(weekPlanEntries.weekPlanId, plan.id))
          .orderBy(asc(weekPlanEntries.sortKey))
          .all()
          .map((item): WeekPlanItem => ({
            entryId: item.entryId,
            source: item.source,
            role: item.role,
            plannedFocusSeconds: item.plannedFocusSeconds,
            sortKey: item.sortKey,
          })),
      })),
      focusSessions: this.getFocusSessions(),
      scheduleBlocks: this.getScheduleBlocks(),
      expenses: this.toExpenses(expenseRows),
      expenseCategories: this.getExpenseCategories(true),
      expenseTags: this.getExpenseTags(true),
      paymentMethods: this.getPaymentMethods(true),
    };
  }

  exportExpenseData(): ExpenseDataExport {
    const data = this.exportUserData();
    return {
      schemaVersion: data.schemaVersion,
      exportedAt: data.exportedAt,
      effectiveTimezone: data.effectiveTimezone,
      expenses: data.expenses,
      expenseCategories: data.expenseCategories,
      expenseTags: data.expenseTags,
      paymentMethods: data.paymentMethods,
    };
  }

  getDashboardPayload(): DashboardPayload {
    const now = this.clock();
    const today = localDateKey(this.clock(), this.timezone);
    const week = this.getStatisticsPayload("week");
    const plan = this.getWeekPlan();
    const entriesForDashboard = this.getEntries();
    const todayEntries = entriesForDashboard.filter((entry) => entry.status === "active" && plan.items.some((item) => item.entryId === entry.id));
    const deadlineEntries = entriesForDashboard.filter((entry) => entry.status === "active" && entry.dueAt !== null);
    const todayBucket = week.daily.find((bucket) => bucket.date === today);
    const nextSchedule = this.getScheduleBlocks().find((block) => parseDate(block.endedAt) >= this.clock().getTime()) ?? null;
    return {
      profile: this.getUser() as UserProfile,
      now: nowIso(() => now),
      nextSchedule,
      activeFocus: this.getActiveFocus(),
      todayEntries,
      deadlineEntries,
      focusSummary: { todaySeconds: todayBucket?.seconds ?? 0, weekSeconds: week.totalSeconds, dailySeconds: week.daily },
      weather: { status: "unavailable" },
      quotation: {
        ...selectSeasonalQuotation(now, this.timezone),
        source: "builtin",
      },
    };
  }
}

export const createSqliteApplicationService = (db: AppDatabase, options: ServiceOptions = {}) =>
  new SqliteApplicationService(db, options);
