import {
  Entry,
  WeekPlan,
  FocusSession,
  ScheduleBlock,
  UserProfile,
  Capabilities,
  DashboardPayload,
  StatisticsPayload,
  IcsImportPreview,
  FocusSegment,
  ScheduleBlockInput,
  UpdateScheduleBlockInput,
  WeekPlanItemInput,
  Expense,
  ExpenseCategory,
  ExpenseTag,
  PaymentMethod,
} from "@/lib/domain/types";
import type { ScenarioPreset } from "@/lib/mock/types";
import { decodeExpenseHistoryCursor, getExpenseHistoryPage, sortExpensesForHistory } from "@/lib/expenses/history";
import { assertValidWeekPlanItemInput, parseWeekStart, WEEK_START_MESSAGES } from "@/lib/domain/week-plan";
import {
  MOCK_USER,
  MOCK_CAPABILITIES_NORMAL,
  MOCK_CAPABILITIES_REG_CLOSED,
  MOCK_ENTRIES_NORMAL,
  MOCK_WEEK_PLANS_NORMAL,
  MOCK_SCHEDULE_BLOCKS_NORMAL,
  MOCK_FOCUS_SESSIONS_NORMAL,
  MOCK_ICS_PREVIEW,
  MOCK_EXPENSES,
  MOCK_EXPENSE_CATEGORIES,
  MOCK_EXPENSE_TAGS,
  MOCK_PAYMENT_METHODS,
} from "./fixtures";
import { MockDomainError } from "./domain";

const DEFAULT_WEEK_START = "2026-06-22";
const REFERENCE_TODAY = "2026-06-26";
const DAY_MS = 24 * 60 * 60 * 1000;

const cloneWeekPlan = (plan: WeekPlan): WeekPlan => ({
  weekStart: plan.weekStart,
  note: plan.note,
  items: plan.items.map((item) => ({ ...item })),
});

const parseYmd = (date: string) => {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  return Date.UTC(year, month - 1, day);
};

const assertValidWeekStart = (weekStart: string) => {
  const issue = parseWeekStart(weekStart);
  if (issue) throw new MockDomainError("REQUEST_INVALID", WEEK_START_MESSAGES[issue]);
};

const formatYmd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const shiftYmd = (date: string, days: number) => formatYmd(parseYmd(date) + days * DAY_MS);

const toRangeBounds = (startDate: string, endDate: string) => ({
  startMs: Date.parse(`${startDate}T00:00:00+08:00`),
  endMs: Date.parse(`${endDate}T00:00:00+08:00`),
});

const normalizeOptionalText = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
};

const normalizeCaptureMessage = normalizeOptionalText;

const assertPositiveInteger = (value: number, message: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new MockDomainError("EXPENSE_INVALID_AMOUNT", message);
  }
};

const assertDateTime = (value: string, message: string) => {
  if (!Number.isFinite(Date.parse(value))) {
    throw new MockDomainError("REQUEST_INVALID", message);
  }
};

const assertDateKey = (value: string, message: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new MockDomainError("REQUEST_INVALID", message);
  }
};

const cloneExpense = (expense: Expense): Expense => ({
  ...expense,
  tags: expense.tags.map((tag) => ({ ...tag })),
});

const intersectSeconds = (
  startedAt: string,
  endedAt: string,
  startMs: number,
  endMs: number
) => {
  const segmentStart = new Date(startedAt).getTime();
  const segmentEnd = new Date(endedAt).getTime();
  const overlapStart = Math.max(segmentStart, startMs);
  const overlapEnd = Math.min(segmentEnd, endMs);
  return Math.max(0, overlapEnd - overlapStart) / 1000;
};

const buildDailyBuckets = (startDate: string, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const date = shiftYmd(startDate, index);
    const { startMs, endMs } = toRangeBounds(date, shiftYmd(date, 1));
    return { date, startMs, endMs };
  });

const getScaleRange = (scale: "day" | "week" | "month" = "week", weekStart?: string) => {
  if (weekStart && scale !== "week") {
    throw new MockDomainError("REQUEST_INVALID", "weekStart 仅支持周统计");
  }

  if (scale === "day") {
    return {
      label: "今日",
      startDate: REFERENCE_TODAY,
      dailyCount: 1,
    };
  }

  if (scale === "month") {
    return {
      label: "本月",
      startDate: "2026-06-01",
      dailyCount: 30,
    };
  }

  return {
    label: "本周",
    startDate: weekStart ?? DEFAULT_WEEK_START,
    dailyCount: 7,
  };
};

export class MockDataStore {
  private scenario: ScenarioPreset = "normal";
  private user: UserProfile | null = MOCK_USER;
  private entries: Entry[] = [...MOCK_ENTRIES_NORMAL];
  private weekPlans = new Map<string, WeekPlan>(
    Object.entries(MOCK_WEEK_PLANS_NORMAL).map(([weekStart, plan]) => [
      weekStart,
      cloneWeekPlan(plan),
    ])
  );
  private scheduleBlocks: ScheduleBlock[] = [...MOCK_SCHEDULE_BLOCKS_NORMAL];
  private focusSessions: FocusSession[] = [...MOCK_FOCUS_SESSIONS_NORMAL];
  private expenses: Expense[] = [
    ...MOCK_EXPENSES.map((expense) => cloneExpense(expense)),
    { ...cloneExpense(MOCK_EXPENSES[0]), id: "exp_reviewed_unclassified", reviewStatus: "reviewed", categoryId: null, note: null },
  ];
  private expenseCategories: ExpenseCategory[] = [...MOCK_EXPENSE_CATEGORIES];
  private expenseTags: ExpenseTag[] = [...MOCK_EXPENSE_TAGS];
  private paymentMethods: PaymentMethod[] = [...MOCK_PAYMENT_METHODS];
  private expenseHistoryRevision = 0;
  private listeners: Array<() => void> = [];
  private credentials = new Map<string, { user: UserProfile; password: string }>([
    [MOCK_USER.username, { user: MOCK_USER, password: "password123" }],
  ]);

  constructor() {
    this.recalculateEntryFocusSeconds();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private invalidateExpenseHistory() {
    this.expenseHistoryRevision += 1;
  }

  public getScenario(): ScenarioPreset {
    return this.scenario;
  }

  public setScenario(preset: ScenarioPreset) {
    this.scenario = preset;
    if (preset === "empty") {
      this.entries = [];
      this.weekPlans = new Map([
        [
          DEFAULT_WEEK_START,
          {
            weekStart: DEFAULT_WEEK_START,
            note: "",
            items: [],
          },
        ],
      ]);
      this.scheduleBlocks = [];
      this.focusSessions = [];
      this.expenseCategories = [];
      this.expenseTags = [];
      this.paymentMethods = [];
      this.expenses = [];
    } else {
      this.user = MOCK_USER;
      this.entries = [...MOCK_ENTRIES_NORMAL];
      this.weekPlans = new Map(
        Object.entries(MOCK_WEEK_PLANS_NORMAL).map(([weekStart, plan]) => [
          weekStart,
          cloneWeekPlan(plan),
        ])
      );
      this.scheduleBlocks = [...MOCK_SCHEDULE_BLOCKS_NORMAL];
      this.focusSessions = [...MOCK_FOCUS_SESSIONS_NORMAL];
      this.expenseCategories = [...MOCK_EXPENSE_CATEGORIES];
      this.expenseTags = [...MOCK_EXPENSE_TAGS];
      this.paymentMethods = [...MOCK_PAYMENT_METHODS];
      this.expenses = [
        ...MOCK_EXPENSES.map((expense) => cloneExpense(expense)),
        { ...cloneExpense(MOCK_EXPENSES[0]), id: "exp_reviewed_unclassified", reviewStatus: "reviewed", categoryId: null, note: null },
      ];
      this.recalculateEntryFocusSeconds();
    }
    this.notify();
  }

  public getCapabilities(): Capabilities {
    if (this.scenario === "reg_closed") {
      return MOCK_CAPABILITIES_REG_CLOSED;
    }
    return MOCK_CAPABILITIES_NORMAL;
  }

  public getUser(): UserProfile | null {
    return this.user;
  }

  public getUserByUsername(username: string): UserProfile | undefined {
    return this.credentials.get(username.trim())?.user;
  }

  public registerUser(username: string, password: string): UserProfile {
    const normalizedUsername = username.trim();
    const user: UserProfile = {
      id: `usr_${Date.now()}`,
      username: normalizedUsername,
      nickname: null,
      email: null,
    };
    this.credentials.set(normalizedUsername, { user, password });
    this.user = user;
    this.notify();
    return user;
  }

  public authenticate(username: string, password: string): UserProfile | null {
    const record = this.credentials.get(username.trim());
    if (!record || record.password !== password) return null;
    this.user = record.user;
    this.notify();
    return this.user;
  }

  public clearSession() {
    this.user = null;
    this.notify();
  }

  public updateUserProfile(nickname: string | null, email: string | null): UserProfile | null {
    if (this.user) {
      this.user = {
        ...this.user,
        nickname,
        email,
      };
      const record = this.credentials.get(this.user.username);
      if (record) record.user = this.user;
      this.notify();
      return this.user;
    }
    return null;
  }

  // --- ENTRIES & AGGREGATE CALCULATIONS ---

  public getEntries(): Entry[] {
    return this.entries.filter((entry) => !entry.deletedAt);
  }

  public getEntryById(id: string): Entry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  private recalculateEntryFocusSeconds() {
    // 1. Calculate direct seconds from all stopped focus segments
    const directMap = new Map<string, number>();
    for (const session of this.focusSessions) {
      if (!session.endedAt) continue;
      for (const segment of session.segments) {
        if (!segment.entryId) continue;
        const duration =
          (new Date(segment.endedAt).getTime() -
            new Date(segment.startedAt).getTime()) /
          1000;
        directMap.set(
          segment.entryId,
          (directMap.get(segment.entryId) || 0) + Math.max(0, duration)
        );
      }
    }

    // Update directFocusSeconds
    this.entries = this.entries.map((entry) => ({
      ...entry,
      directFocusSeconds: directMap.get(entry.id) || entry.directFocusSeconds || 0,
    }));

    // 2. Calculate aggregate seconds (direct + descendant direct seconds)
    const computeAggregate = (entryId: string): number => {
      const entry = this.entries.find((e) => e.id === entryId);
      if (!entry) return 0;
      let total = entry.directFocusSeconds;
      const children = this.entries.filter((e) => e.parentId === entryId);
      for (const child of children) {
        total += computeAggregate(child.id);
      }
      return total;
    };

    this.entries = this.entries.map((entry) => ({
      ...entry,
      aggregateFocusSeconds: computeAggregate(entry.id),
    }));
  }

  public addEntry(input: {
    parentId: string | null;
    title: string;
    description: string | null;
    completionMode: "ongoing" | "completable";
    dueAt: string | null;
  }): Entry {
    const newEntry: Entry = {
      id: `entry_${Date.now()}`,
      parentId: input.parentId,
      title: input.title,
      description: input.description,
      completionMode: input.completionMode,
      status: "active",
      dueAt: input.dueAt,
      directFocusSeconds: 0,
      aggregateFocusSeconds: 0,
      sortKey: `z_${Date.now()}`,
    };
    this.entries.push(newEntry);
    this.recalculateEntryFocusSeconds();
    this.notify();
    return newEntry;
  }

  public updateEntry(id: string, updates: Partial<Entry>): Entry | undefined {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return undefined;
    this.entries[idx] = { ...this.entries[idx], ...updates };
    this.recalculateEntryFocusSeconds();
    this.notify();
    return this.entries[idx];
  }

  public moveEntry(id: string, newParentId: string | null) {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.parentId = newParentId;
      this.recalculateEntryFocusSeconds();
      this.notify();
    }
  }

  public deleteEntry(id: string) {
    // Preserve minimal entry metadata because old focus segments remain facts.
    const toDelete = new Set<string>();
    const collect = (targetId: string) => {
      toDelete.add(targetId);
      this.entries
        .filter((e) => e.parentId === targetId)
        .forEach((c) => collect(c.id));
    };
    collect(id);

    const deletedAt = new Date().toISOString();
    this.entries = this.entries.map((entry) =>
      toDelete.has(entry.id)
        ? {
            ...entry,
            title: `[已删除] ${entry.title}`,
            description: null,
            parentId: null,
            status: "archived",
            deletedAt,
          }
        : entry
    );
    for (const weekPlan of this.weekPlans.values()) {
      weekPlan.items = weekPlan.items.filter((item) => !toDelete.has(item.entryId));
    }
    this.recalculateEntryFocusSeconds();
    this.notify();
  }

  // --- WEEK PLAN ---

  private getOrCreateWeekPlan(weekStart?: string) {
    const normalizedWeekStart = weekStart || DEFAULT_WEEK_START;
    assertValidWeekStart(normalizedWeekStart);
    const existing = this.weekPlans.get(normalizedWeekStart);
    if (existing) return existing;

    const previousWeek = shiftYmd(normalizedWeekStart, -7);
    const previous = this.weekPlans.get(previousWeek);
    const activeEntries = new Map(this.entries.filter((entry) => entry.status === "active").map((entry) => [entry.id, entry]));
    const created: WeekPlan = {
      weekStart: normalizedWeekStart,
      note: previous?.note ?? "",
      items: previous?.items
        .filter((item) => activeEntries.has(item.entryId))
        .map((item) => ({ ...item, source: "rollover" as const })) ?? [],
    };
    this.weekPlans.set(normalizedWeekStart, created);
    return created;
  }

  public getWeekPlan(weekStart?: string): WeekPlan {
    return cloneWeekPlan(this.getOrCreateWeekPlan(weekStart));
  }

  public getExistingWeekPlan(weekStart: string): WeekPlan | null {
    assertValidWeekStart(weekStart);
    const existing = this.weekPlans.get(weekStart);
    return existing ? cloneWeekPlan(existing) : null;
  }

  public updateWeekPlanNote(note: string, weekStart?: string) {
    this.getOrCreateWeekPlan(weekStart).note = note;
    this.notify();
  }

  public addToWeekPlan(entryId: string, weekStart?: string, input?: Partial<WeekPlanItemInput>) {
    const weekPlan = this.getOrCreateWeekPlan(weekStart);
    if (!weekPlan.items.some((i) => i.entryId === entryId)) {
      const entry = this.entries.find((candidate) => candidate.id === entryId);
      const role = input?.role ?? (entry?.completionMode === "ongoing" ? "focus" : "commitment");
      const plannedFocusSeconds = input?.plannedFocusSeconds ?? null;
      assertValidWeekPlanItemInput({ role, plannedFocusSeconds });
      weekPlan.items.push({
        entryId,
        source: "manual",
        role,
        plannedFocusSeconds,
        sortKey: `wp_${Date.now()}`,
      });
      this.notify();
    }
  }

  public updateWeekPlanItem(entryId: string, input: WeekPlanItemInput, weekStart?: string) {
    assertValidWeekPlanItemInput(input);
    const normalizedWeekStart = weekStart || DEFAULT_WEEK_START;
    assertValidWeekStart(normalizedWeekStart);
    const weekPlan = this.weekPlans.get(normalizedWeekStart);
    if (!weekPlan) throw new MockDomainError("WEEK_PLAN_ITEM_NOT_FOUND", "该周计划不存在");
    const item = weekPlan.items.find((candidate) => candidate.entryId === entryId);
    if (!item) throw new MockDomainError("WEEK_PLAN_ITEM_NOT_FOUND", "条目不在该周计划中");
    item.role = input.role;
    item.plannedFocusSeconds = input.plannedFocusSeconds;
    this.notify();
  }

  public removeFromWeekPlan(entryId: string, weekStart?: string) {
    const weekPlan = this.getOrCreateWeekPlan(weekStart);
    weekPlan.items = weekPlan.items.filter(
      (i) => i.entryId !== entryId
    );
    this.notify();
  }

  // --- FOCUS SESSIONS ---

  public getActiveFocus(): FocusSession | null {
    return this.focusSessions.find((s) => s.endedAt === null) || null;
  }

  public getFocusSessions(): FocusSession[] {
    return this.focusSessions;
  }

  public startFocusSession(entryId?: string | null): FocusSession {
    if (this.getActiveFocus()) {
      throw new Error("FOCUS_ALREADY_ACTIVE: 已有活动中的专注会话");
    }

    const now = new Date().toISOString();
    const newSession: FocusSession = {
      id: `foc_${Date.now()}`,
      startedAt: now,
      endedAt: null,
      captureMode: "timer",
      note: null,
      outcome: null,
      segments: [],
    };

    if (entryId) {
      newSession.segments.push({
        id: `seg_${Date.now()}`,
        startedAt: now,
        endedAt: now,
        entryId,
        note: null,
      });
    }

    this.focusSessions.push(newSession);
    this.notify();
    return newSession;
  }

  public stopFocusSession(
    sessionId: string,
    outcome: string | null,
    note: string | null,
    segments: FocusSegment[],
    endedAt = new Date().toISOString()
  ): FocusSession {
    const session = this.focusSessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error("Focus session not found");
    }

    session.endedAt = endedAt;
    session.outcome = outcome;
    session.note = note;

    // If custom segments provided, validate partition bounds
    if (segments && segments.length > 0) {
      session.segments = segments;
    } else if (session.segments.length === 0) {
      // Default single segment covering entire duration (unassigned or default entry)
      session.segments = [
        {
          id: `seg_${Date.now()}`,
          startedAt: session.startedAt,
          endedAt: endedAt,
          entryId: null,
          note: null,
        },
      ];
    } else {
      // Update end time of existing initial segment
      session.segments[0].endedAt = endedAt;
    }

    this.recalculateEntryFocusSeconds();
    this.notify();
    return session;
  }

  public updateFocusSession(sessionId: string, segments: FocusSegment[]): FocusSession {
    const session = this.focusSessions.find((item) => item.id === sessionId);
    if (!session || !session.endedAt) {
      throw new MockDomainError("FOCUS_NOT_FOUND", "已结束的专注会话不存在");
    }
    session.segments = segments.map((segment) => ({ ...segment }));
    this.recalculateEntryFocusSeconds();
    this.notify();
    return session;
  }

  public discardFocusSession(sessionId: string): void {
    const index = this.focusSessions.findIndex((session) => session.id === sessionId && !session.endedAt);
    if (index === -1) {
      throw new MockDomainError("FOCUS_NOT_FOUND", "活动专注会话不存在");
    }

    this.focusSessions.splice(index, 1);
    this.recalculateEntryFocusSeconds();
    this.notify();
  }

  public addManualFocusSession(input: {
    startedAt: string;
    endedAt: string;
    note: string | null;
    outcome: string | null;
    entryId: string | null;
  }): FocusSession {
    const startMs = new Date(input.startedAt).getTime();
    const endMs = new Date(input.endedAt).getTime();

    if (endMs <= startMs) {
      throw new Error("结束时间必须晚于开始时间");
    }

    // Check overlap with existing focus sessions
    for (const session of this.focusSessions) {
      if (!session.endedAt) continue;
      const sStart = new Date(session.startedAt).getTime();
      const sEnd = new Date(session.endedAt).getTime();
      if (startMs < sEnd && endMs > sStart) {
        throw new Error(
          `FOCUS_OVERLAP: 时间段 ${input.startedAt.slice(
            11,
            16
          )}–${input.endedAt.slice(11, 16)} 与已有的专注会话在 ${session.startedAt.slice(
            11,
            16
          )}–${session.endedAt.slice(11, 16)} 重叠！`
        );
      }
    }

    const newSession: FocusSession = {
      id: `foc_man_${Date.now()}`,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      captureMode: "manual",
      note: input.note,
      outcome: input.outcome,
      segments: [
        {
          id: `seg_man_${Date.now()}`,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          entryId: input.entryId,
          note: input.note,
        },
      ],
    };

    this.focusSessions.push(newSession);
    this.recalculateEntryFocusSeconds();
    this.notify();
    return newSession;
  }

  // --- SCHEDULE BLOCKS ---

  public getScheduleBlocks(): ScheduleBlock[] {
    return this.scheduleBlocks;
  }

  public getCalendarPayload(from?: string, to?: string) {
    if (!from || !to) {
      return { scheduleBlocks: this.getScheduleBlocks(), focusSessions: this.getFocusSessions() };
    }
    const startMs = Date.parse(from);
    const endMs = Date.parse(to);
    const overlaps = (startedAt: string, endedAt: string | null) =>
      Date.parse(startedAt) < endMs && Date.parse(endedAt ?? new Date().toISOString()) > startMs;
    return {
      scheduleBlocks: this.scheduleBlocks.filter((block) => overlaps(block.startedAt, block.endedAt)),
      focusSessions: this.focusSessions.filter((session) => overlaps(session.startedAt, session.endedAt)),
    };
  }

  public addScheduleBlock(input: ScheduleBlockInput): ScheduleBlock {
    const newBlock: ScheduleBlock = {
      id: `sch_${Date.now()}`,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      location: input.location,
      colorKey: input.colorKey || "blue",
      recurrence: input.recurrence,
      recurrenceLabel: input.recurrence
        ? `每周重复 (${input.recurrence.weekdays.join(", ")})`
        : null,
    };
    this.scheduleBlocks.push(newBlock);
    this.notify();
    return newBlock;
  }

  public updateScheduleBlock(id: string, input: UpdateScheduleBlockInput): ScheduleBlock {
    const index = this.scheduleBlocks.findIndex((block) => block.id === id);
    if (index < 0) throw new MockDomainError("SCHEDULE_NOT_FOUND", "日程不存在");
    const updated = { ...this.scheduleBlocks[index], ...input };
    if (Date.parse(updated.endedAt) <= Date.parse(updated.startedAt)) {
      throw new MockDomainError("REQUEST_INVALID", "结束时间必须晚于开始时间");
    }
    updated.recurrenceLabel = updated.recurrence
      ? `每周重复 (${updated.recurrence.weekdays.join(", ")})`
      : null;
    this.scheduleBlocks[index] = updated;
    this.notify();
    return updated;
  }

  public deleteScheduleBlock(id: string) {
    this.scheduleBlocks = this.scheduleBlocks.filter((b) => b.id !== id);
    this.notify();
  }

  // --- EXPENSES ---

  private getExpenseCategoryById(id: string) {
    const category = this.expenseCategories.find((item) => item.id === id && item.archivedAt === null);
    if (!category) throw new MockDomainError("EXPENSE_CATEGORY_NOT_FOUND", "分类不存在或已归档");
    return category;
  }

  private getExpenseCategoryByIdIncludingArchived(id: string) {
    const category = this.expenseCategories.find((item) => item.id === id);
    if (!category) throw new MockDomainError("EXPENSE_CATEGORY_NOT_FOUND", "分类不存在");
    return category;
  }

  private getExpenseCategoryByName(name: string, ignoreId?: string) {
    const normalized = name.trim().toLowerCase();
    return this.expenseCategories.find((item) => item.id !== ignoreId && item.name.trim().toLowerCase() === normalized);
  }

  private getExpenseTagById(id: string) {
    const tag = this.expenseTags.find((item) => item.id === id && item.archivedAt === null);
    if (!tag) throw new MockDomainError("EXPENSE_TAG_NOT_FOUND", "标签不存在或已归档");
    return tag;
  }

  private getExpenseTagByIdIncludingArchived(id: string) {
    const tag = this.expenseTags.find((item) => item.id === id);
    if (!tag) throw new MockDomainError("EXPENSE_TAG_NOT_FOUND", "标签不存在");
    return tag;
  }

  private getExpenseTagByName(name: string, ignoreId?: string) {
    const normalized = name.trim().toLowerCase();
    return this.expenseTags.find((item) => item.id !== ignoreId && item.name.trim().toLowerCase() === normalized);
  }

  private getPaymentMethodById(id: string) {
    const method = this.paymentMethods.find((item) => item.id === id && item.archivedAt === null);
    if (!method) throw new MockDomainError("PAYMENT_METHOD_NOT_FOUND", "支付方式不存在或已归档");
    return method;
  }

  private getPaymentMethodByIdIncludingArchived(id: string) {
    const method = this.paymentMethods.find((item) => item.id === id);
    if (!method) throw new MockDomainError("PAYMENT_METHOD_NOT_FOUND", "支付方式不存在");
    return method;
  }

  private getPaymentMethodByName(name: string, ignoreId?: string) {
    const normalized = name.trim().toLowerCase();
    return this.paymentMethods.find((item) => item.id !== ignoreId && item.name.trim().toLowerCase() === normalized);
  }

  private getExpenseRow(id: string, includeDeleted = false) {
    const row = this.expenses.find((expense) => expense.id === id);
    if (!row || (!includeDeleted && row.deletedAt !== null)) {
      throw new MockDomainError("EXPENSE_NOT_FOUND", "开销记录不存在");
    }
    return row;
  }

  public createExpenseCategory(input: { name: string; iconKey?: ExpenseCategory["iconKey"] }): ExpenseCategory {
    const name = input.name.trim();
    if (!name) throw new MockDomainError("REQUEST_INVALID", "名称不能为空");
    if (this.getExpenseCategoryByName(name)) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "分类名称已存在", { name });
    }
    const category: ExpenseCategory = { id: `cat_${Date.now()}_${this.expenseCategories.length}`, name, iconKey: input.iconKey ?? null, archivedAt: null };
    this.expenseCategories.push(category);
    this.notify();
    return { ...category };
  }

  public getExpenseCategories(includeArchived = false): ExpenseCategory[] {
    return this.expenseCategories
      .filter((category) => includeArchived || category.archivedAt === null)
      .map((category) => ({ ...category }));
  }

  public renameExpenseCategory(id: string, input: { name: string; iconKey?: ExpenseCategory["iconKey"] }): ExpenseCategory {
    const category = this.getExpenseCategoryByIdIncludingArchived(id);
    const name = input.name.trim();
    if (!name) throw new MockDomainError("REQUEST_INVALID", "名称不能为空");
    const conflict = this.getExpenseCategoryByName(name, category.id);
    if (conflict) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "分类名称已存在", { name });
    }
    category.name = name;
    if (input.iconKey !== undefined) category.iconKey = input.iconKey;
    this.notify();
    return { ...category };
  }

  public archiveExpenseCategory(id: string): ExpenseCategory {
    const category = this.getExpenseCategoryById(id);
    category.archivedAt = new Date().toISOString();
    this.notify();
    return { ...category };
  }

  public restoreExpenseCategory(id: string): ExpenseCategory {
    const category = this.getExpenseCategoryByIdIncludingArchived(id);
    if (category.archivedAt === null) {
      throw new MockDomainError("EXPENSE_DIMENSION_CONFLICT", "分类已经处于启用状态");
    }
    const conflict = this.getExpenseCategoryByName(category.name, category.id);
    if (conflict) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "分类名称已存在", { name: category.name });
    }
    category.archivedAt = null;
    this.notify();
    return { ...category };
  }

  public mergeExpenseCategory(id: string, input: { targetId: string }): ExpenseCategory {
    const source = this.getExpenseCategoryByIdIncludingArchived(id);
    const target = this.getExpenseCategoryById(input.targetId);
    if (source.id === target.id) {
      throw new MockDomainError("EXPENSE_DIMENSION_CONFLICT", "不能合并到自身");
    }
    for (const expense of this.expenses) {
      if (expense.categoryId === source.id) {
        expense.categoryId = target.id;
      }
    }
    source.archivedAt = new Date().toISOString();
    this.invalidateExpenseHistory();
    this.notify();
    return { ...source };
  }

  public createExpenseTag(input: { name: string; iconKey?: ExpenseTag["iconKey"] }): ExpenseTag {
    const name = input.name.trim();
    if (!name) throw new MockDomainError("REQUEST_INVALID", "名称不能为空");
    if (this.getExpenseTagByName(name)) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "标签名称已存在", { name });
    }
    const tag: ExpenseTag = { id: `tag_${Date.now()}_${this.expenseTags.length}`, name, iconKey: input.iconKey ?? null, archivedAt: null };
    this.expenseTags.push(tag);
    this.notify();
    return { ...tag };
  }

  public getExpenseTags(includeArchived = false): ExpenseTag[] {
    return this.expenseTags
      .filter((tag) => includeArchived || tag.archivedAt === null)
      .map((tag) => ({ ...tag }));
  }

  public renameExpenseTag(id: string, input: { name: string; iconKey?: ExpenseTag["iconKey"] }): ExpenseTag {
    const tag = this.getExpenseTagByIdIncludingArchived(id);
    const name = input.name.trim();
    if (!name) throw new MockDomainError("REQUEST_INVALID", "名称不能为空");
    const conflict = this.getExpenseTagByName(name, tag.id);
    if (conflict) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "标签名称已存在", { name });
    }
    tag.name = name;
    if (input.iconKey !== undefined) tag.iconKey = input.iconKey;
    this.notify();
    return { ...tag };
  }

  public archiveExpenseTag(id: string): ExpenseTag {
    const tag = this.getExpenseTagById(id);
    tag.archivedAt = new Date().toISOString();
    this.notify();
    return { ...tag };
  }

  public restoreExpenseTag(id: string): ExpenseTag {
    const tag = this.getExpenseTagByIdIncludingArchived(id);
    if (tag.archivedAt === null) {
      throw new MockDomainError("EXPENSE_DIMENSION_CONFLICT", "标签已经处于启用状态");
    }
    const conflict = this.getExpenseTagByName(tag.name, tag.id);
    if (conflict) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "标签名称已存在", { name: tag.name });
    }
    tag.archivedAt = null;
    this.notify();
    return { ...tag };
  }

  public mergeExpenseTag(id: string, input: { targetId: string }): ExpenseTag {
    const source = this.getExpenseTagByIdIncludingArchived(id);
    const target = this.getExpenseTagById(input.targetId);
    if (source.id === target.id) {
      throw new MockDomainError("EXPENSE_DIMENSION_CONFLICT", "不能合并到自身");
    }
    for (const expense of this.expenses) {
      const nextTags = expense.tags.map((tag) => (tag.id === source.id ? { ...target } : { ...tag }));
      const deduped = new Map<string, ExpenseTag>();
      for (const tag of nextTags) deduped.set(tag.id, tag);
      expense.tags = Array.from(deduped.values());
    }
    source.archivedAt = new Date().toISOString();
    this.invalidateExpenseHistory();
    this.notify();
    return { ...source };
  }

  public createPaymentMethod(input: { name: string; iconKey?: PaymentMethod["iconKey"] }): PaymentMethod {
    const name = input.name.trim();
    if (!name) throw new MockDomainError("REQUEST_INVALID", "名称不能为空");
    if (this.getPaymentMethodByName(name)) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "支付方式名称已存在", { name });
    }
    const method: PaymentMethod = { id: `pm_${Date.now()}_${this.paymentMethods.length}`, name, iconKey: input.iconKey ?? null, archivedAt: null };
    this.paymentMethods.push(method);
    this.notify();
    return { ...method };
  }

  public getPaymentMethods(includeArchived = false): PaymentMethod[] {
    return this.paymentMethods
      .filter((method) => includeArchived || method.archivedAt === null)
      .map((method) => ({ ...method }));
  }

  public renamePaymentMethod(id: string, input: { name: string; iconKey?: PaymentMethod["iconKey"] }): PaymentMethod {
    const method = this.getPaymentMethodByIdIncludingArchived(id);
    const name = input.name.trim();
    if (!name) throw new MockDomainError("REQUEST_INVALID", "名称不能为空");
    const conflict = this.getPaymentMethodByName(name, method.id);
    if (conflict) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "支付方式名称已存在", { name });
    }
    method.name = name;
    if (input.iconKey !== undefined) method.iconKey = input.iconKey;
    this.notify();
    return { ...method };
  }

  public archivePaymentMethod(id: string): PaymentMethod {
    const method = this.getPaymentMethodById(id);
    method.archivedAt = new Date().toISOString();
    this.notify();
    return { ...method };
  }

  public restorePaymentMethod(id: string): PaymentMethod {
    const method = this.getPaymentMethodByIdIncludingArchived(id);
    if (method.archivedAt === null) {
      throw new MockDomainError("EXPENSE_DIMENSION_CONFLICT", "支付方式已经处于启用状态");
    }
    const conflict = this.getPaymentMethodByName(method.name, method.id);
    if (conflict) {
      throw new MockDomainError("EXPENSE_DIMENSION_NAME_TAKEN", "支付方式名称已存在", { name: method.name });
    }
    method.archivedAt = null;
    this.notify();
    return { ...method };
  }

  public mergePaymentMethod(id: string, input: { targetId: string }): PaymentMethod {
    const source = this.getPaymentMethodByIdIncludingArchived(id);
    const target = this.getPaymentMethodById(input.targetId);
    if (source.id === target.id) {
      throw new MockDomainError("EXPENSE_DIMENSION_CONFLICT", "不能合并到自身");
    }
    for (const expense of this.expenses) {
      if (expense.paymentMethodId === source.id) {
        expense.paymentMethodId = target.id;
      }
    }
    source.archivedAt = new Date().toISOString();
    this.invalidateExpenseHistory();
    this.notify();
    return { ...source };
  }

  public captureExpense(input: {
    id: string;
    amountCents: number;
    currency?: "CNY";
    occurredAt?: string;
    occurredOn?: string;
    occurredTimezone?: string | null;
    occurrencePrecision?: "datetime" | "date";
    captureMessage?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    source?: "shortcut" | "manual";
  }) {
    if (!input.id.trim()) throw new MockDomainError("REQUEST_INVALID", "开销记录 UUID 不能为空");
    assertPositiveInteger(input.amountCents, "金额必须为正整数分");
    if (input.currency !== undefined && input.currency !== "CNY") {
      throw new MockDomainError("REQUEST_INVALID", "首版仅支持 CNY");
    }
    if (input.latitude !== undefined && input.latitude !== null && (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)) {
      throw new MockDomainError("REQUEST_INVALID", "纬度超出有效范围");
    }
    if (input.longitude !== undefined && input.longitude !== null && (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)) {
      throw new MockDomainError("REQUEST_INVALID", "经度超出有效范围");
    }

    const existing = this.expenses.find((expense) => expense.id === input.id);
    if (existing) {
      if (existing.deletedAt !== null) {
        throw new MockDomainError("EXPENSE_DELETED", "已删除的开销记录不能通过重试恢复");
      }
      const conflicts: string[] = [];
      if (input.amountCents !== existing.amountCents) conflicts.push("amountCents");
      if (input.currency !== undefined && input.currency !== existing.currency) conflicts.push("currency");
      if (input.occurredAt !== undefined && input.occurredAt !== existing.occurredAt) conflicts.push("occurredAt");
      if (input.occurredOn !== undefined && input.occurredOn !== existing.occurredOn) conflicts.push("occurredOn");
      if (input.occurredTimezone !== undefined && input.occurredTimezone !== existing.occurredTimezone) conflicts.push("occurredTimezone");
      if (input.occurrencePrecision !== undefined && input.occurrencePrecision !== existing.occurrencePrecision) conflicts.push("occurrencePrecision");
      if (input.captureMessage !== undefined && normalizeCaptureMessage(input.captureMessage) !== existing.captureMessage) conflicts.push("captureMessage");
      if (input.latitude !== undefined && input.latitude !== existing.latitude) conflicts.push("latitude");
      if (input.longitude !== undefined && input.longitude !== existing.longitude) conflicts.push("longitude");
      if (input.source !== undefined && input.source !== existing.source) conflicts.push("source");
      if (conflicts.length > 0) {
        throw new MockDomainError("EXPENSE_IDEMPOTENCY_CONFLICT", "同一 UUID 的捕获字段不一致", {
          id: input.id,
          conflictingFields: conflicts,
        });
      }
      return { created: false, expense: cloneExpense(existing) };
    }

    const recordedAt = new Date().toISOString();
    const precision = input.occurrencePrecision ?? (input.occurredOn ? "date" : "datetime");
    if (input.occurredAt && input.occurredOn) {
      throw new MockDomainError("REQUEST_INVALID", "发生时间和发生日期只能提供一个");
    }
    if (precision === "date") {
      if (!input.occurredOn) throw new MockDomainError("REQUEST_INVALID", "日期精度必须提供 occurredOn");
      assertDateKey(input.occurredOn, "发生日期无效");
    } else {
      const occurredAt = input.occurredAt ?? recordedAt;
      assertDateTime(occurredAt, "发生时间无效");
    }

    const expense: Expense = {
      id: input.id,
      amountCents: input.amountCents,
      currency: "CNY",
      occurredAt: precision === "datetime" ? (input.occurredAt ?? recordedAt) : null,
      occurredOn: precision === "date" ? input.occurredOn ?? null : null,
      occurredTimezone: input.occurredTimezone ?? "Asia/Shanghai",
      occurrencePrecision: precision,
      recordedAt,
      captureMessage: normalizeCaptureMessage(input.captureMessage),
      note: null,
      categoryId: null,
      paymentMethodId: null,
      tags: [],
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
    this.expenses.unshift(expense);
    this.invalidateExpenseHistory();
    this.notify();
    return { created: true, expense: cloneExpense(expense) };
  }

  public getExpenses(): Expense[] {
    return sortExpensesForHistory(
      this.expenses
      .filter((expense) => expense.deletedAt === null)
      .map((expense) => cloneExpense(expense)),
      this.getCapabilities().effectiveTimezone,
    );
  }

  public getExpenseHistoryPage(limit = 25, before?: string) {
    const revision = String(this.expenseHistoryRevision);
    if (before) {
      const cursor = decodeExpenseHistoryCursor(before);
      if (!cursor) throw new MockDomainError("REQUEST_INVALID", "开销历史游标无效");
      if (cursor.revision !== revision) {
        throw new MockDomainError("EXPENSE_HISTORY_STALE", "开销历史已更新，请重新加载");
      }
    }
    return getExpenseHistoryPage(
      this.expenses.filter((expense) => expense.deletedAt === null).map((expense) => cloneExpense(expense)),
      this.getCapabilities().effectiveTimezone,
      limit,
      before,
      revision,
    );
  }

  public getInboxExpenses(): Expense[] {
    return this.expenses
      .filter((expense) => expense.deletedAt === null && expense.reviewStatus === "pending")
      .map((expense) => cloneExpense(expense))
      .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt));
  }

  public getExpenseById(id: string, includeDeleted = false): Expense | undefined {
    const expense = this.expenses.find((item) => item.id === id);
    if (!expense || (!includeDeleted && expense.deletedAt !== null)) return undefined;
    return cloneExpense(expense);
  }

  public updateExpense(
    id: string,
    input: {
      amountCents?: number;
      occurredAt?: string | null;
      occurredOn?: string | null;
      occurrencePrecision?: "datetime" | "date";
      note?: string | null;
      categoryId?: string | null;
      paymentMethodId?: string | null;
      reviewStatus?: "pending" | "reviewed";
      tagIds?: string[];
      recoverableCents?: number;
      settled?: boolean;
    }
  ): Expense {
    const current = this.getExpenseRow(id);
    if (input.amountCents !== undefined) assertPositiveInteger(input.amountCents, "金额必须为正整数分");
    if (input.occurredAt !== undefined && input.occurredAt !== null) { assertDateTime(input.occurredAt, "发生时间无效"); current.occurredAt = input.occurredAt; current.occurredOn = null; current.occurrencePrecision = "datetime"; }
    if (input.occurredOn !== undefined && input.occurredOn !== null) { assertDateKey(input.occurredOn, "发生日期无效"); current.occurredOn = input.occurredOn; current.occurredAt = null; current.occurrencePrecision = "date"; }
    if (input.categoryId !== undefined && input.categoryId !== null) this.getExpenseCategoryById(input.categoryId);
    if (input.paymentMethodId !== undefined && input.paymentMethodId !== null) this.getPaymentMethodById(input.paymentMethodId);
    const tagIds = input.tagIds === undefined ? undefined : [...new Set(input.tagIds)];
    tagIds?.forEach((tagId) => this.getExpenseTagById(tagId));
    const nextAmountCents = input.amountCents ?? current.amountCents;
    if (input.recoverableCents !== undefined) {
      if (!Number.isSafeInteger(input.recoverableCents) || input.recoverableCents < 0 || input.recoverableCents > nextAmountCents) {
        throw new MockDomainError("REQUEST_INVALID", "预计可收回金额必须是介于零和开销金额之间的整数分");
      }
    }
    if (input.recoverableCents === undefined && current.recoverableCents > nextAmountCents) {
      throw new MockDomainError("REQUEST_INVALID", "新的金额不能低于预计可收回金额");
    }

    if (input.amountCents !== undefined) current.amountCents = input.amountCents;
    current.note = input.note === undefined ? current.note : normalizeOptionalText(input.note);
    current.categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;
    current.paymentMethodId = input.paymentMethodId === undefined ? current.paymentMethodId : input.paymentMethodId;
    current.reviewStatus = input.reviewStatus ?? current.reviewStatus;
    current.recoverableCents = input.recoverableCents ?? current.recoverableCents;
    current.settled = input.settled ?? current.settled;
    current.tags =
      tagIds === undefined
        ? current.tags.map((tag) => ({ ...tag }))
        : tagIds.map((tagId) => ({ ...this.getExpenseTagById(tagId) }));
    current.updatedAt = new Date().toISOString();
    this.invalidateExpenseHistory();
    this.notify();
    return cloneExpense(current);
  }

  public deleteExpense(id: string): void {
    const current = this.getExpenseRow(id);
    current.deletedAt = new Date().toISOString();
    current.updatedAt = current.deletedAt;
    this.invalidateExpenseHistory();
    this.notify();
  }

  // --- ICS IMPORT ---

  public getIcsPreview(): IcsImportPreview {
    return MOCK_ICS_PREVIEW;
  }

  public confirmIcsImport(selectedUids: string[]): number {
    let importedCount = 0;
    for (const uid of selectedUids) {
      const row = MOCK_ICS_PREVIEW.rows.find((r) => r.sourceUid === uid);
      if (row) {
        this.addScheduleBlock({
          kind: "course",
          title: row.title,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
          location: null,
          colorKey: "purple",
          recurrence: null,
        });
        importedCount++;
      }
    }
    return importedCount;
  }

  // --- DASHBOARD & STATISTICS PAYLOADS ---

  public getDashboardPayload(): DashboardPayload {
    const activeFocus = this.getActiveFocus();
    const todayStr = "2026-06-26"; // Reference date

    // Calculate today seconds
    let todaySeconds = 0;
    let weekSeconds = 0;

    for (const session of this.focusSessions) {
      if (!session.endedAt) continue;
      const duration =
        (new Date(session.endedAt).getTime() -
          new Date(session.startedAt).getTime()) /
        1000;
      if (session.startedAt.startsWith(todayStr)) {
        todaySeconds += duration;
      }
      weekSeconds += duration;
    }

    const currentWeekPlan = this.getOrCreateWeekPlan(DEFAULT_WEEK_START);

    const todayEntries = this.entries.filter(
      (e) =>
        e.status === "active" &&
        currentWeekPlan.items.some((w) => w.entryId === e.id)
    );

    const deadlineEntries = this.entries.filter(
      (e) => e.status === "active" && e.dueAt !== null
    );

    const weatherStatus =
      this.scenario === "weather_stale"
        ? "stale"
        : this.scenario === "weather_unavailable"
        ? "unavailable"
        : "fresh";

    return {
      profile: this.user || MOCK_USER,
      now: new Date().toISOString(),
      nextSchedule: this.scheduleBlocks[0] || null,
      activeFocus,
      todayEntries,
      deadlineEntries,
      focusSummary: {
        todaySeconds,
        weekSeconds,
        dailySeconds: [
          { date: "2026-06-22", seconds: 7200 },
          { date: "2026-06-23", seconds: 10800 },
          { date: "2026-06-24", seconds: 14400 },
          { date: "2026-06-25", seconds: 9000 },
          { date: "2026-06-26", seconds: todaySeconds },
          { date: "2026-06-27", seconds: 0 },
          { date: "2026-06-28", seconds: 0 },
        ],
      },
      weather: {
        status: weatherStatus,
        temperatureC: weatherStatus !== "unavailable" ? 26 : undefined,
        summary: weatherStatus !== "unavailable" ? "晴朗 26°C / 微风" : undefined,
        observedAt: weatherStatus === "stale" ? "2 小时前" : "刚刚",
      },
      quotation: {
        text: "万物皆有裂痕，那是光照进来的地方。",
        author: "莱昂纳德·科恩",
        work: "《颂歌》",
        source: "builtin",
        sourceUrl: "https://www.gushiwen.cn/",
        catalogVersion: "mock",
      },
    };
  }

  public getStatisticsPayload(scale?: "day" | "week" | "month", weekStart?: string): StatisticsPayload {
    if (weekStart) assertValidWeekStart(weekStart);
    const { startDate, dailyCount } = getScaleRange(scale, weekStart);
    const dailyBuckets = buildDailyBuckets(startDate, dailyCount).map((bucket) => ({
      date: bucket.date,
      startMs: bucket.startMs,
      endMs: bucket.endMs,
      seconds: 0,
    }));
    const rangeStartMs = dailyBuckets[0]?.startMs ?? toRangeBounds(startDate, shiftYmd(startDate, 1)).startMs;
    const rangeEndMs = dailyBuckets[dailyBuckets.length - 1]?.endMs ?? toRangeBounds(startDate, shiftYmd(startDate, 1)).endMs;

    let totalSeconds = 0;
    let unassignedSeconds = 0;
    const directSecondsByEntry = new Map<string, number>();

    for (const session of this.focusSessions) {
      if (!session.endedAt) continue;
      for (const segment of session.segments) {
        const segmentSeconds = intersectSeconds(
          segment.startedAt,
          segment.endedAt,
          rangeStartMs,
          rangeEndMs
        );
        if (segmentSeconds <= 0) continue;

        totalSeconds += segmentSeconds;
        if (!segment.entryId) {
          unassignedSeconds += segmentSeconds;
        } else {
          directSecondsByEntry.set(
            segment.entryId,
            (directSecondsByEntry.get(segment.entryId) || 0) + segmentSeconds
          );
        }

        for (const bucket of dailyBuckets) {
          bucket.seconds += intersectSeconds(
            segment.startedAt,
            segment.endedAt,
            bucket.startMs,
            bucket.endMs
          );
        }
      }
    }

    const directMap = new Map<string, number>();
    for (const [entryId, seconds] of directSecondsByEntry.entries()) {
      directMap.set(entryId, seconds);
    }

    const computeAggregate = (entryId: string): number => {
      const entry = this.entries.find((candidate) => candidate.id === entryId);
      if (!entry) return 0;
      let total = directMap.get(entryId) || 0;
      for (const child of this.entries.filter((candidate) => candidate.parentId === entryId)) {
        total += computeAggregate(child.id);
      }
      return total;
    };

    const roots = this.entries
      .filter((e) => e.parentId === null)
      .map((entry) => ({
        entryId: entry.id,
        directSeconds: directMap.get(entry.id) || 0,
        aggregateSeconds: computeAggregate(entry.id),
      }));
    const entryBreakdown = this.entries.map((entry) => ({
      entryId: entry.id,
      directSeconds: directMap.get(entry.id) || 0,
      aggregateSeconds: computeAggregate(entry.id),
    }));

    return {
      totalSeconds,
      unassignedSeconds,
      daily: dailyBuckets.map(({ date, seconds }) => ({ date, seconds })),
      entryBreakdown,
      roots,
    };
  }
}

// Global Singleton Instance
export const mockStore = new MockDataStore();
