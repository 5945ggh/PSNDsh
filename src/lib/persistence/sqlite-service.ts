import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "@/lib/db";
import {
  entries,
  focusSegments,
  focusSessions,
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
  LoginInput,
  ManualFocusInput,
  RegisterInput,
  UpdateEntryInput,
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
  FocusSegment,
  FocusSession,
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
} from "@/lib/domain/types";

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

export class SqliteApplicationService implements ApplicationService {
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

  private entrySeconds(entryId: string) {
    const rows = this.db
      .select({ startedAt: focusSegments.startedAt, endedAt: focusSegments.endedAt })
      .from(focusSegments)
      .innerJoin(focusSessions, eq(focusSegments.sessionId, focusSessions.id))
      .where(
        and(
          eq(focusSegments.entryId, entryId),
          eq(focusSessions.userId, this.requireUserId()),
          sql`${focusSessions.endedAt} is not null`
        )
      )
      .all();
    return rows.reduce((sum, row) => sum + Math.max(0, (parseDate(row.endedAt) - parseDate(row.startedAt)) / 1000), 0);
  }

  private toEntry(row: EntryRow, allRows?: EntryRow[]): Entry {
    const rows = allRows ?? this.db.select().from(entries).where(eq(entries.userId, this.requireUserId())).all();
    const directFocusSeconds = this.entrySeconds(row.id);
    const aggregate = (entryId: string): number => {
      const current = rows.find((candidate) => candidate.id === entryId);
      if (!current) return 0;
      return directFor(current.id) + rows
        .filter((candidate) => candidate.parentId === entryId)
        .reduce((sum, child) => sum + aggregate(child.id), 0);
    };
    const directFor = (entryId: string) => entryId === row.id ? directFocusSeconds : this.entrySeconds(entryId);
    return {
      id: row.id,
      parentId: row.parentId,
      title: row.title,
      description: row.description,
      completionMode: row.completionMode,
      status: row.status,
      dueAt: row.dueAt,
      directFocusSeconds,
      aggregateFocusSeconds: aggregate(row.id),
      sortKey: row.sortKey,
      deletedAt: row.deletedAt,
    };
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
      templateApplicationId: row.templateApplicationId,
    };
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
    return rows.map((row) => this.toEntry(row, rows));
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
    const existing = this.db.select().from(weekPlans).where(and(eq(weekPlans.userId, userId), eq(weekPlans.weekStart, normalized))).get();
    if (existing) return existing;
    const createdAt = nowIso(this.clock);
    const plan = { id: randomUUID(), userId, weekStart: normalized, note: "", createdAt, updatedAt: createdAt };
    this.db.transaction((tx) => {
      tx.insert(weekPlans).values(plan).run();
      const previousWeek = shiftDateKey(normalized, -7);
      const previous = tx.select().from(weekPlans).where(and(eq(weekPlans.userId, userId), eq(weekPlans.weekStart, previousWeek))).get();
      if (!previous) return;
      const previousItems = tx.select().from(weekPlanEntries).where(eq(weekPlanEntries.weekPlanId, previous.id)).all();
      const ownedEntries = tx.select().from(entries).where(eq(entries.userId, userId)).all();
      for (const item of previousItems) {
        const entry = ownedEntries.find((candidate) => candidate.id === item.entryId);
        if (!entry || entry.deletedAt !== null || entry.status !== "active") continue;
        tx.insert(weekPlanEntries).values({
          id: randomUUID(), weekPlanId: plan.id, entryId: entry.id, source: "rollover", sortKey: item.sortKey,
        }).onConflictDoNothing().run();
      }
    });
    return this.db.select().from(weekPlans).where(eq(weekPlans.id, plan.id)).get() as typeof weekPlans.$inferSelect;
  }

  getWeekPlan(weekStart?: string): WeekPlan {
    const plan = this.ensureWeekPlan(weekStart);
    const items = this.db.select().from(weekPlanEntries).where(eq(weekPlanEntries.weekPlanId, plan.id)).orderBy(asc(weekPlanEntries.sortKey)).all();
    return {
      weekStart: plan.weekStart,
      note: plan.note,
      items: items.map((item): WeekPlanItem => ({ entryId: item.entryId, source: item.source, sortKey: item.sortKey })),
    };
  }

  updateWeekPlanNote(note: string, weekStart?: string): void {
    const plan = this.ensureWeekPlan(weekStart);
    this.db.update(weekPlans).set({ note, updatedAt: nowIso(this.clock) }).where(eq(weekPlans.id, plan.id)).run();
  }

  addToWeekPlan(entryId: string, weekStart?: string): void {
    this.getOwnedEntryRow(entryId, false);
    const plan = this.ensureWeekPlan(weekStart);
    this.db.insert(weekPlanEntries).values({ id: randomUUID(), weekPlanId: plan.id, entryId, source: "manual", sortKey: `z_${nowIso(this.clock)}_${randomUUID().slice(0, 8)}` }).onConflictDoNothing().run();
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

  importIcsScheduleBlocks(blocks: Array<ScheduleBlockInput & { sourceUid?: string }>, fileName = "导入日程.ics"): number {
    const userId = this.requireUserId();
    const createdAt = nowIso(this.clock);
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
      tx.insert(scheduleImports).values({ id: importId, userId, fileName: fileName.trim() || "导入日程.ics", createdAt }).run();
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
        createdAt,
        updatedAt: createdAt,
      }))).run();
    });
    return newBlocks.length;
  }

  getScheduleImports(): ScheduleImport[] {
    const userId = this.requireUserId();
    return this.db.select().from(scheduleImports)
      .where(eq(scheduleImports.userId, userId))
      .orderBy(desc(scheduleImports.createdAt)).all()
      .map((row) => ({
        id: row.id,
        fileName: row.fileName,
        importedAt: row.createdAt,
        blockCount: this.db.select({ count: sql<number>`count(*)` }).from(scheduleBlocks)
          .where(eq(scheduleBlocks.importId, row.id)).get()?.count ?? 0,
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

  private rangeForScale(scale: "day" | "week" | "month" = "week") {
    const today = localDateKey(this.clock(), this.timezone);
    const startDate = scale === "day" ? today : scale === "week" ? mondayOf(today) : `${today.slice(0, 7)}-01`;
    const dailyCount = scale === "day" ? 1 : scale === "week" ? 7 : Number(shiftDateKey(startDate, 1).slice(8, 10)) === 1 ? 28 : new Date(Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)), 0)).getUTCDate();
    return { startDate, dailyCount };
  }

  getStatisticsPayload(scale: "day" | "week" | "month" = "week"): StatisticsPayload {
    const { startDate, dailyCount } = this.rangeForScale(scale);
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

    return {
      schemaVersion: "1.0",
      exportedAt: nowIso(this.clock),
      effectiveTimezone: this.timezone,
      profile: this.toUser(this.getUserRow()!),
      entries: allEntryRows.map((entry) => this.toEntry(entry, allEntryRows)),
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
            sortKey: item.sortKey,
          })),
      })),
      focusSessions: this.getFocusSessions(),
      scheduleBlocks: this.getScheduleBlocks(),
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
