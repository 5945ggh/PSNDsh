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
} from "@/lib/domain/types";
import type { ScenarioPreset } from "@/lib/mock/types";
import {
  MOCK_USER,
  MOCK_CAPABILITIES_NORMAL,
  MOCK_CAPABILITIES_REG_CLOSED,
  MOCK_ENTRIES_NORMAL,
  MOCK_WEEK_PLANS_NORMAL,
  MOCK_SCHEDULE_BLOCKS_NORMAL,
  MOCK_FOCUS_SESSIONS_NORMAL,
  MOCK_ICS_PREVIEW,
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

const formatYmd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const shiftYmd = (date: string, days: number) => formatYmd(parseYmd(date) + days * DAY_MS);

const toRangeBounds = (startDate: string, endDate: string) => ({
  startMs: Date.parse(`${startDate}T00:00:00+08:00`),
  endMs: Date.parse(`${endDate}T00:00:00+08:00`),
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

const getScaleRange = (scale: "day" | "week" | "month" = "week") => {
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
    startDate: DEFAULT_WEEK_START,
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
    const existing = this.weekPlans.get(normalizedWeekStart);
    if (existing) return existing;

    const created: WeekPlan = {
      weekStart: normalizedWeekStart,
      note: "",
      items: [],
    };
    this.weekPlans.set(normalizedWeekStart, created);
    return created;
  }

  public getWeekPlan(weekStart?: string): WeekPlan {
    return cloneWeekPlan(this.getOrCreateWeekPlan(weekStart));
  }

  public updateWeekPlanNote(note: string, weekStart?: string) {
    this.getOrCreateWeekPlan(weekStart).note = note;
    this.notify();
  }

  public addToWeekPlan(entryId: string, weekStart?: string) {
    const weekPlan = this.getOrCreateWeekPlan(weekStart);
    if (!weekPlan.items.some((i) => i.entryId === entryId)) {
      weekPlan.items.push({
        entryId,
        source: "manual",
        sortKey: `wp_${Date.now()}`,
      });
      this.notify();
    }
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

  public getStatisticsPayload(scale?: "day" | "week" | "month"): StatisticsPayload {
    const { startDate, dailyCount } = getScaleRange(scale);
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
