import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ApplicationError } from "@/lib/application/error";
import { QUOTATION_CATALOG_VERSION } from "@/lib/ambient/quotations";
import { openDatabase } from "@/lib/db";
import { entries, expenses, focusSegments, users, weekPlans } from "@/lib/db/schema";
import { sortExpensesForHistory } from "@/lib/expenses/history";
import { SqliteApplicationService } from "./sqlite-service";

const USER_A = "user-a";
const USER_B = "user-b";
const at = (value: string) => new Date(value);

const seedUser = (db: ReturnType<typeof openDatabase>["db"], id: string, username = id) => {
  db.insert(users).values({
    id,
    username,
    passwordHash: null,
    nickname: null,
    profileEmail: null,
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
  }).run();
};

describe("SqliteApplicationService", () => {
  let handle: ReturnType<typeof openDatabase>;
  let currentTime: Date;

  beforeEach(() => {
    handle = openDatabase(":memory:");
    currentTime = at("2026-06-26T12:00:00.000Z");
    seedUser(handle.db, USER_A);
    seedUser(handle.db, USER_B);
  });

  const service = (userId: string | null = USER_A) => new SqliteApplicationService(handle.db, {
    userId,
    clock: () => currentTime,
    effectiveTimezone: "Asia/Shanghai",
  });

  it("keeps entry trees user-owned and rejects self/descendant moves and ongoing completion", () => {
    const app = service();
    const root = app.addEntry({ parentId: null, title: "方向", description: null, completionMode: "ongoing", dueAt: null });
    const child = app.addEntry({ parentId: root.id, title: "任务", description: null, completionMode: "completable", dueAt: null });

    expect(() => app.moveEntry(root.id, root.id)).toThrow(/ENTRY_MOVE_INVALID/);
    expect(() => app.moveEntry(root.id, child.id)).toThrow(/ENTRY_MOVE_INVALID/);
    expect(() => app.updateEntry(root.id, { status: "completed" })).toThrow(/ENTRY_STATUS_INVALID/);
    expect(app.getEntryById(root.id)?.parentId).toBeNull();
  });

  it("preserves direct and aggregate focus totals across a deep and wide entry tree", () => {
    const app = service();
    const root = app.addEntry({ parentId: null, title: "总项目", description: null, completionMode: "ongoing", dueAt: null });
    const groups = Array.from({ length: 4 }, (_, groupIndex) => app.addEntry({
      parentId: root.id,
      title: `分组 ${groupIndex + 1}`,
      description: null,
      completionMode: "ongoing",
      dueAt: null,
    }));
    const leaves = groups.flatMap((group, groupIndex) => Array.from({ length: 5 }, (_, leafIndex) => app.addEntry({
      parentId: group.id,
      title: `叶项 ${groupIndex + 1}-${leafIndex + 1}`,
      description: null,
      completionMode: "completable",
      dueAt: null,
    })));
    const focusTime = (offsetSeconds: number) => new Date(Date.parse("2026-06-26T01:00:00.000Z") + offsetSeconds * 1000).toISOString();

    app.addManualFocusSession({ startedAt: focusTime(0), endedAt: focusTime(120), note: null, outcome: null, entryId: root.id });
    groups.forEach((group, index) => {
      const startSeconds = 600 + index * 180;
      app.addManualFocusSession({
        startedAt: focusTime(startSeconds),
        endedAt: focusTime(startSeconds + 60),
        note: null,
        outcome: null,
        entryId: group.id,
      });
    });
    leaves.forEach((leaf, index) => {
      const startSeconds = 1800 + index * 120;
      app.addManualFocusSession({
        startedAt: focusTime(startSeconds),
        endedAt: focusTime(startSeconds + 30),
        note: null,
        outcome: null,
        entryId: leaf.id,
      });
    });

    const result = new Map(app.getEntries().map((entry) => [entry.id, entry]));
    expect(result.get(root.id)).toMatchObject({ directFocusSeconds: 120, aggregateFocusSeconds: 960 });
    expect(result.get(groups[0]!.id)).toMatchObject({ directFocusSeconds: 60, aggregateFocusSeconds: 210 });
    expect(result.get(leaves[0]!.id)).toMatchObject({ directFocusSeconds: 30, aggregateFocusSeconds: 30 });
    expect(result.get(leaves.at(-1)!.id)).toMatchObject({ directFocusSeconds: 30, aggregateFocusSeconds: 30 });
  });

  it("rolls active entries into the next week once without copying the entry", () => {
    const app = service();
    const rollover = app.addEntry({ parentId: null, title: "继续事项", description: null, completionMode: "completable", dueAt: null });
    const completed = app.addEntry({ parentId: null, title: "已完成", description: null, completionMode: "completable", dueAt: null });
    const archived = app.addEntry({ parentId: null, title: "已归档", description: null, completionMode: "completable", dueAt: null });
    app.updateEntry(completed.id, { status: "completed" });
    app.updateEntry(archived.id, { status: "archived" });
    app.updateWeekPlanNote("## 上周清单\n- [ ] 继续事项", "2026-06-22");
    app.addToWeekPlan(rollover.id, "2026-06-22", { role: "focus", plannedFocusSeconds: 10800 });
    app.addToWeekPlan(completed.id, "2026-06-22");
    app.addToWeekPlan(archived.id, "2026-06-22");

    const first = app.getWeekPlan("2026-06-29");
    const second = app.getWeekPlan("2026-06-29");
    expect(first.note).toBe("## 上周清单\n- [ ] 继续事项");
    expect(first.items).toEqual([{
      entryId: rollover.id,
      source: "rollover",
      role: "focus",
      plannedFocusSeconds: 10800,
      sortKey: expect.any(String),
    }]);
    expect(second.items).toEqual(first.items);
    expect(app.getEntries().filter((entry) => entry.id === rollover.id)).toHaveLength(1);

    app.updateWeekPlanItem(rollover.id, { role: "focus", plannedFocusSeconds: 14400 }, "2026-06-29");
    expect(app.getWeekPlan("2026-06-29").items.find((item) => item.entryId === rollover.id)?.plannedFocusSeconds).toBe(14400);
    expect(app.getWeekPlan("2026-06-22").items.find((item) => item.entryId === rollover.id)?.plannedFocusSeconds).toBe(10800);
  });

  it("reads existing week plans without creating missing historical plans", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "已有计划", description: null, completionMode: "completable", dueAt: null });
    app.addToWeekPlan(entry.id, "2026-06-22");

    expect(app.getExistingWeekPlan("2026-06-22")).toEqual(app.getWeekPlan("2026-06-22"));
    expect(app.getExistingWeekPlan("2026-07-06")).toBeNull();
    expect(handle.db.select().from(weekPlans).where(eq(weekPlans.weekStart, "2026-07-06")).all()).toHaveLength(0);

    expect(() => app.getExistingWeekPlan("2026-06-23")).toThrow(/REQUEST_INVALID/);
    expect(() => app.getWeekPlan("2026-02-30")).toThrow(/REQUEST_INVALID/);
  });

  it("rejects planned focus time for commitment items", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "结构化事项", description: null, completionMode: "completable", dueAt: null });

    expect(() => app.addToWeekPlan(entry.id, "2026-06-22", {
      role: "commitment",
      plannedFocusSeconds: 3_600,
    })).toThrow(/REQUEST_INVALID/);

    app.addToWeekPlan(entry.id, "2026-06-22", { role: "commitment" });
    expect(() => app.updateWeekPlanItem(entry.id, {
      role: "commitment",
      plannedFocusSeconds: 3_600,
    }, "2026-06-22")).toThrow(/REQUEST_INVALID/);
  });

  it("rejects negative or fractional planned focus time at the service boundary", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "关注项", description: null, completionMode: "ongoing", dueAt: null });

    expect(() => app.addToWeekPlan(entry.id, "2026-06-22", {
      role: "focus",
      plannedFocusSeconds: -3_600,
    })).toThrow(/REQUEST_INVALID/);
    expect(() => app.addToWeekPlan(entry.id, "2026-06-22", {
      role: "focus",
      plannedFocusSeconds: 1.5,
    })).toThrow(/REQUEST_INVALID/);
  });

  it("rejects updating an item outside the week plan without creating the plan", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "未纳入", description: null, completionMode: "ongoing", dueAt: null });

    expect(() => app.updateWeekPlanItem(entry.id, {
      role: "focus",
      plannedFocusSeconds: 3_600,
    }, "2026-06-22")).toThrow(/WEEK_PLAN_ITEM_NOT_FOUND/);
    expect(app.getExistingWeekPlan("2026-06-22")).toBeNull();

    app.addToWeekPlan(entry.id, "2026-06-22", { role: "focus", plannedFocusSeconds: null });
    const other = app.addEntry({ parentId: null, title: "其他", description: null, completionMode: "ongoing", dueAt: null });
    expect(() => app.updateWeekPlanItem(other.id, {
      role: "focus",
      plannedFocusSeconds: 3_600,
    }, "2026-06-22")).toThrow(/WEEK_PLAN_ITEM_NOT_FOUND/);
  });

  it("excludes historical focus from the selected week's entry aggregate", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "本周关注", description: null, completionMode: "ongoing", dueAt: null });
    app.addManualFocusSession({
      startedAt: "2026-06-20T09:00:00+08:00",
      endedAt: "2026-06-20T11:00:00+08:00",
      note: null,
      outcome: null,
      entryId: entry.id,
    });
    app.addToWeekPlan(entry.id, "2026-06-22", { role: "focus", plannedFocusSeconds: null });

    expect(app.getEntries().find((candidate) => candidate.id === entry.id)?.aggregateFocusSeconds).toBe(7_200);
    expect(app.getStatisticsPayload("week", "2026-06-22").entryBreakdown.find((item) => item.entryId === entry.id)).toMatchObject({
      directSeconds: 0,
      aggregateSeconds: 0,
    });
  });

  it("keeps focus facts isolated, permits schedule overlap, and splits cross-midnight time by local day", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "夜间工作", description: null, completionMode: "completable", dueAt: null });
    const session = app.addManualFocusSession({
      startedAt: "2026-06-25T23:30:00+08:00",
      endedAt: "2026-06-26T00:30:00+08:00",
      note: null,
      outcome: null,
      entryId: entry.id,
    });
    const schedule = app.addScheduleBlock({
      kind: "course",
      title: "同时发生的课程",
      startedAt: "2026-06-25T23:45:00+08:00",
      endedAt: "2026-06-26T00:15:00+08:00",
      location: null,
      colorKey: "blue",
      recurrence: null,
    });

    expect(schedule.startedAt).toContain("23:45");
    expect(session.segments).toHaveLength(1);
    const week = app.getStatisticsPayload("week");
    expect(week.daily.find((bucket) => bucket.date === "2026-06-25")?.seconds).toBe(1_800);
    expect(week.daily.find((bucket) => bucket.date === "2026-06-26")?.seconds).toBe(1_800);
    expect(week.totalSeconds).toBe(3_600);
    expect(week.unassignedSeconds).toBe(0);
  });

  it("returns week statistics for a caller-selected Monday using the effective timezone", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "历史投入", description: null, completionMode: "completable", dueAt: null });
    app.addManualFocusSession({
      startedAt: "2026-06-17T23:30:00+08:00",
      endedAt: "2026-06-18T00:30:00+08:00",
      note: null,
      outcome: null,
      entryId: entry.id,
    });

    const selectedWeek = app.getStatisticsPayload("week", "2026-06-15");

    expect(selectedWeek.daily).toEqual([
      { date: "2026-06-15", seconds: 0 },
      { date: "2026-06-16", seconds: 0 },
      { date: "2026-06-17", seconds: 1_800 },
      { date: "2026-06-18", seconds: 1_800 },
      { date: "2026-06-19", seconds: 0 },
      { date: "2026-06-20", seconds: 0 },
      { date: "2026-06-21", seconds: 0 },
    ]);
    expect(selectedWeek.totalSeconds).toBe(3_600);
    expect(selectedWeek.entryBreakdown.find((item) => item.entryId === entry.id)?.directSeconds).toBe(3_600);
    expect(() => app.getStatisticsPayload("day", "2026-06-15")).toThrow(/REQUEST_INVALID/);
  });

  it("updates owned schedules and returns calendar records that overlap a requested half-open range", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const focus = appA.addManualFocusSession({
      startedAt: "2026-06-25T23:30:00+08:00",
      endedAt: "2026-06-26T00:30:00+08:00",
      note: null,
      outcome: null,
      entryId: null,
    });
    const overlapping = appA.addScheduleBlock({
      kind: "course",
      title: "跨日课程",
      startedAt: "2026-06-25T23:45:00+08:00",
      endedAt: "2026-06-26T00:15:00+08:00",
      location: "教室 A",
      colorKey: "blue",
      recurrence: null,
    });
    appA.addScheduleBlock({
      kind: "other",
      title: "范围外日程",
      startedAt: "2026-06-26T02:00:00+08:00",
      endedAt: "2026-06-26T03:00:00+08:00",
      location: null,
      colorKey: "amber",
      recurrence: null,
    });

    const calendar = appA.getCalendarPayload(
      "2026-06-26T00:00:00+08:00",
      "2026-06-26T01:00:00+08:00"
    );
    expect(calendar.scheduleBlocks.map((block) => block.id)).toEqual([overlapping.id]);
    expect(calendar.focusSessions.map((session) => session.id)).toEqual([focus.id]);

    const updated = appA.updateScheduleBlock(overlapping.id, {
      title: "已编辑的跨日课程",
      kind: "plan",
      location: "线上",
      colorKey: "green",
    });
    expect(updated).toMatchObject({
      id: overlapping.id,
      title: "已编辑的跨日课程",
      kind: "plan",
      location: "线上",
      colorKey: "green",
    });
    expect(() => appA.updateScheduleBlock(overlapping.id, {
      startedAt: "2026-06-26T02:00:00+08:00",
      endedAt: "2026-06-26T01:00:00+08:00",
    })).toThrow(/SEGMENTS_INVALID_PARTITION/);
    expect(() => appB.updateScheduleBlock(overlapping.id, { title: "越权修改" })).toThrow(/SCHEDULE_NOT_FOUND/);
    expect(() => appB.deleteScheduleBlock(overlapping.id)).toThrow(/SCHEDULE_NOT_FOUND/);
  });

  it("writes confirmed ICS instances only for the current user", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const count = appA.importIcsScheduleBlocks([
      {
        kind: "course",
        title: "已导入课程",
        startedAt: "2026-06-29T01:00:00.000Z",
        endedAt: "2026-06-29T02:00:00.000Z",
        location: "线上",
        description: "带会议链接的课程",
        sourceUid: "ics-course-a",
        colorKey: "purple",
        recurrence: null,
      },
    ]);

    expect(count).toBe(1);
    expect(appA.getScheduleBlocks()).toEqual([expect.objectContaining({ title: "已导入课程", description: "带会议链接的课程", sourceUid: "ics-course-a", recurrence: null })]);
    expect(appB.getScheduleBlocks()).toEqual([]);
  });

  it("tracks ICS batches, skips a repeated source UID, and deletes a whole batch", () => {
    const app = service();
    const block = {
      kind: "course" as const,
      title: "课表课程",
      startedAt: "2026-06-29T01:00:00.000Z",
      endedAt: "2026-06-29T02:00:00.000Z",
      location: "教室 A",
      colorKey: "purple",
      recurrence: null,
      sourceUid: "same-course",
    };

    expect(app.importIcsScheduleBlocks([block], "spring.ics")).toBe(1);
    expect(app.importIcsScheduleBlocks([block], "spring-again.ics")).toBe(0);
    expect(app.getScheduleImports()).toEqual([expect.objectContaining({ fileName: "spring.ics", blockCount: 1 })]);
    const importId = app.getScheduleImports()[0]!.id;
    app.deleteScheduleImport(importId);
    expect(app.getScheduleBlocks()).toEqual([]);
    expect(app.getScheduleImports()).toEqual([]);
  });

  it("updates a stable ICS source by instance key and removes missing instances in the sync window", () => {
    const app = service();
    const first = {
      kind: "course" as const,
      title: "周一课程",
      startedAt: "2026-06-29T01:00:00.000Z",
      endedAt: "2026-06-29T02:00:00.000Z",
      location: "教室 A",
      colorKey: "purple",
      recurrence: null,
      sourceUid: "stable-course",
      sourceInstanceKey: "start:2026-06-29T01:00:00.000Z",
    };
    const second = {
      ...first,
      title: "周三课程",
      startedAt: "2026-07-01T01:00:00.000Z",
      endedAt: "2026-07-01T02:00:00.000Z",
      sourceInstanceKey: "start:2026-07-01T01:00:00.000Z",
    };
    expect(app.importIcsScheduleBlocks([first, second], "spring.ics", {
      sourceKey: "prodid::spring",
      sourceName: "春季课表",
      syncWindow: { from: "2026-06-26T12:00:00.000Z", to: "2026-12-23T12:00:00.000Z" },
    })).toBe(2);
    expect(app.importIcsScheduleBlocks([{
      ...first,
      title: "周一课程（调整后）",
    }], "spring-renamed.ics", {
      sourceKey: "prodid::spring",
      sourceName: "春季课表",
      syncWindow: { from: "2026-06-26T12:00:00.000Z", to: "2026-12-23T12:00:00.000Z" },
      preserveSourceUids: ["stable-course"],
    })).toBe(1);
    expect(app.getScheduleBlocks()).toHaveLength(2);
    expect(app.importIcsScheduleBlocks([{
      ...first,
      title: "周一课程（调整后）",
    }], "spring-renamed.ics", {
      sourceKey: "prodid::spring",
      sourceName: "春季课表",
      syncWindow: { from: "2026-06-26T12:00:00.000Z", to: "2026-12-23T12:00:00.000Z" },
    })).toBe(1);
    expect(app.getScheduleBlocks()).toEqual([expect.objectContaining({
      title: "周一课程（调整后）",
      sourceInstanceKey: "start:2026-06-29T01:00:00.000Z",
    })]);
    expect(app.getScheduleImports()).toEqual([expect.objectContaining({
      sourceKey: "prodid::spring",
      sourceName: "春季课表",
      fileName: "spring-renamed.ics",
      blockCount: 1,
      changeCount: 1,
    })]);
  });

  it("removes cancelled source instances when the update does not preserve their UID", () => {
    const app = service();
    const block = {
      kind: "course" as const,
      title: "已取消课程",
      startedAt: "2026-06-29T01:00:00.000Z",
      endedAt: "2026-06-29T02:00:00.000Z",
      location: null,
      colorKey: "purple",
      recurrence: null,
      sourceUid: "cancelled-course",
      sourceInstanceKey: "start:2026-06-29T01:00:00.000Z",
    };
    const syncWindow = { from: "2026-06-26T12:00:00.000Z", to: "2026-12-23T12:00:00.000Z" };

    expect(app.importIcsScheduleBlocks([block], "spring.ics", {
      sourceKey: "prodid::spring",
      sourceName: "春季课表",
      syncWindow,
    })).toBe(1);
    expect(app.importIcsScheduleBlocks([], "spring.ics", {
      sourceKey: "prodid::spring",
      sourceName: "春季课表",
      syncWindow,
      removedSourceUids: ["cancelled-course"],
      preserveSourceUids: [],
    })).toBe(1);
    expect(app.getScheduleBlocks()).toEqual([]);
  });

  it("projects weekly schedule rules into a requested calendar range", () => {
    const app = service();
    const rule = app.addScheduleBlock({
      kind: "plan",
      title: "工作日学习",
      startedAt: "2026-06-22T09:00:00+08:00",
      endedAt: "2026-06-22T10:00:00+08:00",
      location: null,
      colorKey: "green",
      recurrence: { frequency: "weekly", interval: 1, weekdays: ["MO", "WE", "FR"], until: null },
    });

    const calendar = app.getCalendarPayload("2026-06-22T00:00:00+08:00", "2026-06-29T00:00:00+08:00");
    expect(calendar.scheduleBlocks).toHaveLength(3);
    expect(calendar.scheduleBlocks.map((block) => block.id)).toEqual([
      `${rule.id}::2026-06-22`,
      `${rule.id}::2026-06-24`,
      `${rule.id}::2026-06-26`,
    ]);
    expect(calendar.scheduleBlocks.every((block) => block.recurrenceSourceId === rule.id)).toBe(true);
  });

  it("expands reusable templates across weekdays, weekends, and overnight boundaries", () => {
    const app = service();
    const template = app.createScheduleTemplate({
      name: "假期作息",
      description: "工作日和周末不同安排",
      items: [
        {
          weekdays: ["MO", "TU", "WE", "TH", "FR"],
          title: "学习",
          description: "上午专注学习",
          kind: "plan",
          location: "书桌",
          colorKey: "green",
          startTime: "09:00",
          endTime: "10:30",
        },
        {
          weekdays: ["SA", "SU"],
          title: "娱乐",
          description: null,
          kind: "other",
          location: null,
          colorKey: "amber",
          startTime: "14:00",
          endTime: "16:00",
        },
        {
          weekdays: ["FR"],
          title: "夜间作息",
          description: null,
          kind: "other",
          location: null,
          colorKey: "blue",
          startTime: "23:30",
          endTime: "00:30",
        },
      ],
    });

    const preview = app.previewScheduleTemplate(template.id, "2026-06-22", "2026-06-28");
    expect(preview.blocks).toHaveLength(8);
    expect(preview.blocks.filter((block) => block.title === "学习")).toHaveLength(5);
    expect(preview.blocks.filter((block) => block.title === "娱乐")).toHaveLength(2);
    expect(preview.blocks.find((block) => block.title === "夜间作息")).toMatchObject({
      startedAt: "2026-06-26T15:30:00.000Z",
      endedAt: "2026-06-26T16:30:00.000Z",
    });

    const application = app.applyScheduleTemplate(template.id, "2026-06-22", "2026-06-28");
    expect(application.blockCount).toBe(8);
    expect(app.getScheduleBlocks().filter((block) => block.templateApplicationId === application.id)).toHaveLength(8);
    expect(app.getScheduleTemplateApplications()).toEqual([
      expect.objectContaining({ id: application.id, blockCount: 8 }),
    ]);
  });

  it("keeps generated instances stable when a template changes and deletes applications as a batch", () => {
    const app = service();
    const template = app.createScheduleTemplate({
      name: "可编辑作息",
      description: null,
      items: [{
        weekdays: ["MO"],
        title: "旧标题",
        description: null,
        kind: "plan",
        location: null,
        colorKey: "blue",
        startTime: "09:00",
        endTime: "10:00",
      }],
    });
    const application = app.applyScheduleTemplate(template.id, "2026-06-22", "2026-06-22");
    app.updateScheduleTemplate(template.id, {
      name: "新版作息",
      description: null,
      items: [{
        weekdays: ["MO"],
        title: "新标题",
        description: null,
        kind: "plan",
        location: null,
        colorKey: "rose",
        startTime: "11:00",
        endTime: "12:00",
      }],
    });

    expect(app.getScheduleBlocks()).toEqual([
      expect.objectContaining({ title: "旧标题", startedAt: "2026-06-22T01:00:00.000Z", templateApplicationId: application.id }),
    ]);
    expect(app.getScheduleTemplates()[0]).toMatchObject({ name: "新版作息", items: [expect.objectContaining({ title: "新标题" })] });
    app.deleteScheduleTemplateApplication(application.id);
    expect(app.getScheduleBlocks()).toEqual([]);
    expect(app.getScheduleTemplates()).toHaveLength(1);
  });

  it("isolates template reads, applications, and batch deletes by user", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const template = appA.createScheduleTemplate({
      name: "A 的模板",
      description: null,
      items: [{
        weekdays: ["MO"],
        title: "A 的日程",
        description: null,
        kind: "other",
        location: null,
        colorKey: "blue",
        startTime: "09:00",
        endTime: "10:00",
      }],
    });
    expect(appB.getScheduleTemplates()).toEqual([]);
    expect(() => appB.previewScheduleTemplate(template.id, "2026-06-22", "2026-06-22")).toThrow(/SCHEDULE_TEMPLATE_NOT_FOUND/);
    const application = appA.applyScheduleTemplate(template.id, "2026-06-22", "2026-06-22");
    expect(appB.getScheduleTemplateApplications()).toEqual([]);
    expect(() => appB.deleteScheduleTemplateApplication(application.id)).toThrow(/SCHEDULE_TEMPLATE_APPLICATION_NOT_FOUND/);
    expect(appA.getScheduleTemplateApplications()).toHaveLength(1);
  });

  it("includes an overnight recurrence that starts before the requested local range", () => {
    const app = service();
    const rule = app.addScheduleBlock({
      kind: "plan",
      title: "夜间作息",
      startedAt: "2026-06-28T23:30:00+08:00",
      endedAt: "2026-06-29T00:30:00+08:00",
      location: null,
      colorKey: "blue",
      recurrence: { frequency: "weekly", interval: 1, weekdays: ["SU"], until: null },
    });

    const calendar = app.getCalendarPayload("2026-06-29T00:00:00+08:00", "2026-06-29T01:00:00+08:00");
    expect(calendar.scheduleBlocks).toEqual([
      expect.objectContaining({
        id: `${rule.id}::2026-06-28`,
        startedAt: "2026-06-28T15:30:00.000Z",
        endedAt: "2026-06-28T16:30:00.000Z",
      }),
    ]);
  });

  it("keeps weekly recurrence local time across a New York DST transition", () => {
    const app = new SqliteApplicationService(handle.db, {
      userId: USER_A,
      clock: () => currentTime,
      effectiveTimezone: "America/New_York",
    });
    const rule = app.addScheduleBlock({
      kind: "plan",
      title: "纽约学习",
      startedAt: "2026-03-02T09:00:00-05:00",
      endedAt: "2026-03-02T10:00:00-05:00",
      location: null,
      colorKey: "green",
      recurrence: { frequency: "weekly", interval: 1, weekdays: ["MO"], until: null },
    });

    const calendar = app.getCalendarPayload("2026-03-08T00:00:00-05:00", "2026-03-17T00:00:00-04:00");
    expect(calendar.scheduleBlocks.map((block) => [block.id, block.startedAt, block.endedAt])).toEqual([
      [`${rule.id}::2026-03-09`, "2026-03-09T13:00:00.000Z", "2026-03-09T14:00:00.000Z"],
      [`${rule.id}::2026-03-16`, "2026-03-16T13:00:00.000Z", "2026-03-16T14:00:00.000Z"],
    ]);
  });

  it("requires gap-free focus partitions and preserves total duration after reassignment", () => {
    const app = service();
    const firstEntry = app.addEntry({ parentId: null, title: "第一项", description: null, completionMode: "completable", dueAt: null });
    const secondEntry = app.addEntry({ parentId: null, title: "第二项", description: null, completionMode: "completable", dueAt: null });
    currentTime = at("2026-06-26T10:00:00.000Z");
    const active = app.startFocusSession();
    currentTime = at("2026-06-26T11:00:00.000Z");
    expect(() => app.stopFocusSession(active.id, null, null, [
      { id: "a", startedAt: active.startedAt, endedAt: "2026-06-26T10:30:00.000Z", entryId: firstEntry.id, note: null },
      { id: "b", startedAt: "2026-06-26T10:35:00.000Z", endedAt: "2026-06-26T11:00:00.000Z", entryId: secondEntry.id, note: null },
    ])).toThrow(/SEGMENTS_INVALID_PARTITION/);
    expect(app.getActiveFocus()?.id).toBe(active.id);

    const stopped = app.stopFocusSession(active.id, null, null, [
      { id: "a", startedAt: active.startedAt, endedAt: "2026-06-26T10:30:00.000Z", entryId: firstEntry.id, note: null },
      { id: "b", startedAt: "2026-06-26T10:30:00.000Z", endedAt: "2026-06-26T11:00:00.000Z", entryId: secondEntry.id, note: null },
    ]);
    expect(stopped.segments.map((segment) => segment.entryId)).toEqual([firstEntry.id, secondEntry.id]);
    expect(stopped.segments.reduce((sum, segment) => sum + (Date.parse(segment.endedAt) - Date.parse(segment.startedAt)), 0)).toBe(3_600_000);
  });

  it("binds an ended unassigned focus session to an owned entry", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "补记归属", description: null, completionMode: "completable", dueAt: null });
    const session = app.addManualFocusSession({
      startedAt: "2026-06-26T09:00:00.000Z",
      endedAt: "2026-06-26T10:00:00.000Z",
      note: "历史记录",
      outcome: "完成阅读",
      entryId: null,
    });

    const updated = app.updateFocusSession(session.id, session.segments.map((segment) => ({
      ...segment,
      entryId: entry.id,
    })));

    expect(updated).toMatchObject({
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      note: "历史记录",
      outcome: "完成阅读",
    });
    expect(updated.segments).toEqual([
      expect.objectContaining({
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        entryId: entry.id,
      }),
    ]);
    expect(app.getEntries().find((candidate) => candidate.id === entry.id)?.directFocusSeconds).toBe(3_600);
  });

  it("does not let one user reassign another user's historical focus session", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const session = appA.addManualFocusSession({
      startedAt: "2026-06-26T09:00:00.000Z",
      endedAt: "2026-06-26T10:00:00.000Z",
      note: null,
      outcome: null,
      entryId: null,
    });
    const entryB = appB.addEntry({ parentId: null, title: "B 的条目", description: null, completionMode: "completable", dueAt: null });

    expect(() => appB.updateFocusSession(session.id, session.segments.map((segment) => ({
      ...segment,
      entryId: entryB.id,
    })))).toThrow(/FOCUS_NOT_FOUND/);
    expect(appA.getFocusSessions().find((candidate) => candidate.id === session.id)?.segments[0]?.entryId).toBeNull();
  });

  it("rejects invalid historical focus partitions without replacing the saved segments", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "归属目标", description: null, completionMode: "completable", dueAt: null });
    const session = app.addManualFocusSession({
      startedAt: "2026-06-26T09:00:00.000Z",
      endedAt: "2026-06-26T10:00:00.000Z",
      note: null,
      outcome: null,
      entryId: null,
    });

    expect(() => app.updateFocusSession(session.id, [{
      ...session.segments[0]!,
      endedAt: "2026-06-26T09:55:00.000Z",
      entryId: entry.id,
    }])).toThrow(/SEGMENTS_INVALID_PARTITION/);
    expect(app.getFocusSessions().find((candidate) => candidate.id === session.id)?.segments).toEqual(session.segments);
  });

  it("preserves a 90-second split as 60 seconds plus 30 seconds", () => {
    const app = service();
    const firstEntry = app.addEntry({ parentId: null, title: "第一项", description: null, completionMode: "completable", dueAt: null });
    const secondEntry = app.addEntry({ parentId: null, title: "第二项", description: null, completionMode: "completable", dueAt: null });
    currentTime = at("2026-06-26T10:00:00.000Z");
    const active = app.startFocusSession();
    currentTime = at("2026-06-26T10:01:30.000Z");

    const stopped = app.stopFocusSession(active.id, null, null, [
      { id: "first", startedAt: active.startedAt, endedAt: "2026-06-26T10:01:00.000Z", entryId: firstEntry.id, note: null },
      { id: "second", startedAt: "2026-06-26T10:01:00.000Z", endedAt: "2026-06-26T10:01:30.000Z", entryId: secondEntry.id, note: null },
    ]);

    expect(stopped.segments.map((segment) => [segment.startedAt, segment.endedAt])).toEqual([
      ["2026-06-26T10:00:00.000Z", "2026-06-26T10:01:00.000Z"],
      ["2026-06-26T10:01:00.000Z", "2026-06-26T10:01:30.000Z"],
    ]);
  });

  it("persists an unassigned timer when the client submits no custom partition", () => {
    const app = service();
    currentTime = at("2026-06-26T10:00:00.000Z");
    const active = app.startFocusSession();
    currentTime = at("2026-06-26T10:05:00.000Z");

    const stopped = app.stopFocusSession(active.id, null, null, []);

    expect(stopped.endedAt).toBe("2026-06-26T10:05:00.000Z");
    expect(app.getActiveFocus()).toBeNull();
    expect(stopped.segments).toEqual([
      expect.objectContaining({
        startedAt: active.startedAt,
        endedAt: stopped.endedAt,
        entryId: null,
      }),
    ]);
  });

  it("discards only the current timer without creating a history record", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "待放弃", description: null, completionMode: "completable", dueAt: null });
    currentTime = at("2026-06-26T10:00:00.000Z");
    const active = app.startFocusSession(entry.id);
    expect(handle.db.select().from(focusSegments).all()).toHaveLength(1);

    app.discardFocusSession();

    expect(app.getActiveFocus()).toBeNull();
    expect(app.getFocusSessions().some((session) => session.id === active.id)).toBe(false);
    expect(handle.db.select().from(focusSegments).all()).toHaveLength(0);
    expect(() => app.discardFocusSession()).toThrow(/FOCUS_NOT_FOUND/);
    expect(app.startFocusSession()).toEqual(expect.objectContaining({ captureMode: "timer", endedAt: null }));
  });

  it("leaves a tombstone and historical segment explainable after entry deletion", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "保留历史", description: null, completionMode: "completable", dueAt: null });
    app.addManualFocusSession({ startedAt: "2026-06-26T09:00:00.000Z", endedAt: "2026-06-26T09:30:00.000Z", note: null, outcome: null, entryId: entry.id });
    app.deleteEntry(entry.id);

    expect(app.getEntries().some((candidate) => candidate.id === entry.id)).toBe(false);
    expect(app.getFocusSessions()[0].segments[0].entryId).toBe(entry.id);
    const tombstone = handle.db.select().from(entries).where(eq(entries.id, entry.id)).get();
    expect(tombstone?.deletedAt).toEqual(expect.any(String));
    expect(tombstone?.title).toContain("[已删除]");
  });

  it("does not cross the user boundary", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const entry = appA.addEntry({ parentId: null, title: "只属于 A", description: null, completionMode: "completable", dueAt: null });
    expect(appB.getEntryById(entry.id)).toBeUndefined();
    expect(() => appB.updateEntry(entry.id, { title: "越权" })).toThrow(ApplicationError);
    expect(() => appB.addToWeekPlan(entry.id, "2026-06-22")).toThrow(/ENTRY_NOT_FOUND/);
  });

  it("captures a minimal CNY expense with the required default states", () => {
    const captured = service().captureExpense({ id: "expense-minimal", amountCents: 1_250 });

    expect(captured).toEqual({
      created: true,
      expense: expect.objectContaining({
        id: "expense-minimal",
        amountCents: 1_250,
        currency: "CNY",
        occurredAt: "2026-06-26T12:00:00.000Z",
        occurredOn: null,
        recordedAt: "2026-06-26T12:00:00.000Z",
        recognitionStatus: "recognized",
        reviewStatus: "pending",
        source: "shortcut",
        categoryId: null,
        paymentMethodId: null,
        tags: [],
        recoverableCents: 0,
        settled: false,
        deletedAt: null,
      }),
    });
    expect(service().getExpenses()).toEqual([expect.objectContaining({ id: "expense-minimal" })]);
    expect(service().getInboxExpenses()).toEqual([expect.objectContaining({ id: "expense-minimal" })]);
  });

  it("rejects non-positive or fractional expense amounts", () => {
    const app = service();

    expect(() => app.captureExpense({ id: "expense-zero", amountCents: 0 })).toThrow(/EXPENSE_INVALID_AMOUNT/);
    expect(() => app.captureExpense({ id: "expense-negative", amountCents: -1 })).toThrow(/EXPENSE_INVALID_AMOUNT/);
    expect(() => app.captureExpense({ id: "expense-fraction", amountCents: 1.5 })).toThrow(/EXPENSE_INVALID_AMOUNT/);
  });

  it("rejects impossible calendar dates for expense occurrence", () => {
    const app = service();

    expect(() => app.captureExpense({ id: "expense-invalid-date", amountCents: 100, occurredOn: "2026-02-30" }))
      .toThrow(/REQUEST_INVALID/);
  });

  it("returns the existing expense for an idempotent retry and reports conflicting UUID fields", () => {
    const app = service();
    const first = app.captureExpense({ id: "expense-retry", amountCents: 2_500 });
    currentTime = at("2026-06-26T12:05:00.000Z");
    const retried = app.captureExpense({ id: "expense-retry", amountCents: 2_500 });

    expect(retried).toEqual({ created: false, expense: first.expense });
    expect(app.getExpenses()).toHaveLength(1);
    try {
      app.captureExpense({ id: "expense-retry", amountCents: 2_501 });
      throw new Error("expected idempotency conflict");
    } catch (error) {
      expect(error).toMatchObject({
        code: "EXPENSE_IDEMPOTENCY_CONFLICT",
        details: { id: "expense-retry", conflictingFields: ["amountCents"] },
      } satisfies Partial<ApplicationError>);
    }
  });

  it("keeps same client UUIDs isolated by user", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const expenseA = appA.captureExpense({ id: "shared-client-uuid", amountCents: 100 }).expense;
    const expenseB = appB.captureExpense({ id: "shared-client-uuid", amountCents: 200 }).expense;

    expect(expenseA.amountCents).toBe(100);
    expect(expenseB.amountCents).toBe(200);
    expect(appA.getExpenses()).toEqual([expect.objectContaining({ id: "shared-client-uuid", amountCents: 100 })]);
    expect(appB.getExpenses()).toEqual([expect.objectContaining({ id: "shared-client-uuid", amountCents: 200 })]);
    const onlyA = appA.captureExpense({ id: "expense-only-a", amountCents: 300 }).expense;
    expect(appB.getExpenseById(onlyA.id)).toBeUndefined();
    expect(() => appB.updateExpense(onlyA.id, { note: "越权" })).toThrow(/EXPENSE_NOT_FOUND/);
    expect(() => appB.deleteExpense(onlyA.id)).toThrow(/EXPENSE_NOT_FOUND/);
  });

  it("keeps an expense UUID tombstone after soft deletion and prevents late retries from reviving it", () => {
    const app = service();
    app.captureExpense({ id: "expense-deleted", amountCents: 888 });
    app.deleteExpense("expense-deleted");

    expect(app.getExpenses()).toEqual([]);
    expect(app.getExpenseById("expense-deleted")).toBeUndefined();
    expect(app.getExpenseById("expense-deleted", { includeDeleted: true })).toEqual(expect.objectContaining({
      id: "expense-deleted",
      deletedAt: expect.any(String),
    }));
    expect(() => app.captureExpense({ id: "expense-deleted", amountCents: 888 })).toThrow(/EXPENSE_DELETED/);
  });

  it("pages mixed occurrence precisions with the effective-timezone history key", () => {
    const app = new SqliteApplicationService(handle.db, {
      userId: USER_A,
      clock: () => currentTime,
      effectiveTimezone: "America/New_York",
    });
    const capture = (id: string, occurredAt: string | null, occurredOn: string | null) => {
      const result = app.captureExpense({
        id,
        amountCents: 100,
        ...(occurredAt ? { occurredAt, occurrencePrecision: "datetime" as const } : {
          occurredOn: occurredOn!,
          occurrencePrecision: "date" as const,
        }),
      });
      currentTime = new Date(currentTime.getTime() + 1_000);
      return result.expense;
    };

    const captured = [
      capture("datetime-jun-28", "2026-06-29T02:00:00.000Z", null),
      capture("date-jun-29-early", null, "2026-06-29"),
      capture("datetime-jun-29", "2026-06-29T15:00:00.000Z", null),
      capture("date-jun-29-late", null, "2026-06-29"),
      capture("datetime-jun-30", "2026-06-30T01:00:00.000Z", null),
      capture("date-jun-28", null, "2026-06-28"),
    ];
    const expectedIds = sortExpensesForHistory(captured, "America/New_York").map((expense) => expense.id);

    const first = app.getExpenseHistoryPage(2);
    const second = app.getExpenseHistoryPage(2, first.nextCursor ?? undefined);
    const third = app.getExpenseHistoryPage(2, second.nextCursor ?? undefined);

    expect([...first.items, ...second.items, ...third.items].map((expense) => expense.id)).toEqual(expectedIds);
    expect(new Set([...first.items, ...second.items, ...third.items].map((expense) => expense.id))).toHaveLength(captured.length);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(second.nextCursor).toEqual(expect.any(String));
    expect(third).toMatchObject({ hasMore: false, nextCursor: null });
    expect(handle.db.select().from(expenses).all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ historyDateKey: "2026-06-29", historyOccurredAtMs: expect.any(Number) }),
      expect.objectContaining({ historyDateKey: "2026-06-29", historyOccurredAtMs: 0 }),
    ]));
  });

  it("rejects a continuation cursor after an unloaded history record changes", () => {
    const app = service();
    app.captureExpense({ id: "history-newest", amountCents: 100, occurredAt: "2026-06-28T10:00:00.000Z" });
    app.captureExpense({ id: "history-middle", amountCents: 100, occurredAt: "2026-06-27T10:00:00.000Z" });
    app.captureExpense({ id: "history-unloaded", amountCents: 100, occurredAt: "2026-06-26T10:00:00.000Z" });

    const first = app.getExpenseHistoryPage(2);
    app.updateExpense("history-unloaded", { occurredAt: "2026-06-29T10:00:00.000Z" });

    try {
      app.getExpenseHistoryPage(2, first.nextCursor ?? undefined);
      throw new Error("expected stale history cursor");
    } catch (error) {
      expect(error).toMatchObject({ code: "EXPENSE_HISTORY_STALE" } satisfies Partial<ApplicationError>);
    }
  });

  it("applies expense history search and dimension/date filters in persistence", () => {
    const app = service();
    const category = app.createExpenseCategory({ name: "餐饮" });
    const paymentMethod = app.createPaymentMethod({ name: "微信" });
    const tag = app.createExpenseTag({ name: "工作" });
    const first = app.captureExpense({ id: "filter-first", amountCents: 100, occurredOn: "2026-06-20", captureMessage: "午餐" }).expense;
    app.updateExpense(first.id, { categoryId: category.id, paymentMethodId: paymentMethod.id, tagIds: [tag.id], reviewStatus: "reviewed" });
    app.captureExpense({ id: "filter-second", amountCents: 200, occurredOn: "2026-06-25", captureMessage: "交通" });

    expect(app.getExpenseHistoryPage(25, undefined, { q: "午餐", categoryId: category.id, paymentMethodId: paymentMethod.id, tagId: tag.id, reviewStatus: "reviewed", from: "2026-06-20", to: "2026-06-20" }).items.map((item) => item.id)).toEqual([first.id]);
    expect(app.getExpenseHistoryPage(25, undefined, { from: "2026-06-21" }).items.map((item) => item.id)).toEqual(["filter-second"]);
  });

  it("preserves occurrence facts separately from recorded time and supports independent inbox organization", () => {
    const app = service();
    const category = app.createExpenseCategory({ name: "餐饮" });
    const tag = app.createExpenseTag({ name: "出差" });
    const paymentMethod = app.createPaymentMethod({ name: "校园卡" });
    const expense = app.captureExpense({
      id: "expense-organize",
      amountCents: 3_600,
      occurredAt: "2026-06-20T08:30:00.000Z",
      occurredTimezone: "Asia/Shanghai",
      captureMessage: "早餐",
    }).expense;

    expect(expense.occurredAt).toBe("2026-06-20T08:30:00.000Z");
    expect(expense.recordedAt).toBe("2026-06-26T12:00:00.000Z");
    const organized = app.updateExpense(expense.id, {
      note: "食堂早餐",
      categoryId: category.id,
      tagIds: [tag.id],
      paymentMethodId: paymentMethod.id,
      reviewStatus: "reviewed",
    });
    expect(organized).toMatchObject({
      note: "食堂早餐",
      categoryId: category.id,
      paymentMethodId: paymentMethod.id,
      reviewStatus: "reviewed",
      tags: [{ id: tag.id, name: "出差" }],
    });
    expect(app.getInboxExpenses()).toEqual([]);

    const unclassifiedReviewed = app.captureExpense({ id: "expense-unclassified", amountCents: 42 }).expense;
    const reviewed = app.updateExpense(unclassifiedReviewed.id, { reviewStatus: "reviewed" });
    expect(reviewed).toEqual(expect.objectContaining({ categoryId: null, reviewStatus: "reviewed" }));
    expect(app.getExpenses().map((record) => record.id)).toContain(unclassifiedReviewed.id);
  });

  it("rejects profile reads without an authenticated user", () => {
    expect(() => service(null).getUser()).toThrow(/UNAUTHORIZED/);
  });

  it("serves a local seasonal quotation without an external request", () => {
    const payload = service().getDashboardPayload();

    expect(payload.quotation).toMatchObject({
      text: expect.any(String),
      author: expect.any(String),
      work: expect.any(String),
      source: "builtin",
      sourceUrl: "https://www.gushiwen.cn/",
      catalogVersion: QUOTATION_CATALOG_VERSION,
    });
    expect(payload.quotation.text).not.toBe("");
  });

  it("exports only the current user's non-sensitive business data", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const entryA = appA.addEntry({ parentId: null, title: "可导出条目", description: null, completionMode: "completable", dueAt: null });
    appA.addToWeekPlan(entryA.id, "2026-06-22");
    appA.addManualFocusSession({
      startedAt: "2026-06-26T09:00:00.000Z",
      endedAt: "2026-06-26T09:30:00.000Z",
      note: "导出测试",
      outcome: null,
      entryId: entryA.id,
    });
    appA.addScheduleBlock({
      kind: "course",
      title: "导出课程",
      startedAt: "2026-06-26T10:00:00.000Z",
      endedAt: "2026-06-26T11:00:00.000Z",
      location: null,
      colorKey: "blue",
      recurrence: null,
    });
    const category = appA.createExpenseCategory({ name: "餐饮", iconKey: "utensils" });
    const archivedCategory = appA.createExpenseCategory({ name: "已归档分类" });
    appA.archiveExpenseCategory(archivedCategory.id);
    const tag = appA.createExpenseTag({ name: "工作日", iconKey: "tag" });
    const paymentMethod = appA.createPaymentMethod({ name: "微信支付", iconKey: "smartphone" });
    const expense = appA.captureExpense({
      id: "expense-export-a",
      amountCents: 1250,
      occurredOn: "2026-06-25",
      captureMessage: "午餐",
    }).expense;
    const updatedExpense = appA.updateExpense(expense.id, {
      categoryId: category.id,
      paymentMethodId: paymentMethod.id,
      tagIds: [tag.id],
      reviewStatus: "reviewed",
    });
    appA.deleteExpense(updatedExpense.id);
    const entryB = appB.addEntry({ parentId: null, title: "不能导出的条目", description: null, completionMode: "completable", dueAt: null });

    const exported = appA.exportUserData();
    const serialized = JSON.stringify(exported);
    expect(exported).toMatchObject({
      schemaVersion: "1.1",
      effectiveTimezone: "Asia/Shanghai",
      profile: { id: USER_A },
    });
    expect(exported.entries.map((entry) => entry.id)).toContain(entryA.id);
    expect(exported.entries.map((entry) => entry.id)).not.toContain(entryB.id);
    expect(exported.weekPlans).toContainEqual(expect.objectContaining({
      weekStart: "2026-06-22",
      items: [expect.objectContaining({ entryId: entryA.id })],
    }));
    expect(exported.focusSessions).toHaveLength(1);
    expect(exported.scheduleBlocks).toHaveLength(1);
    expect(exported.expenses).toHaveLength(1);
    expect(exported.expenses[0]).toMatchObject({
      id: expense.id,
      deletedAt: expect.any(String),
      categoryId: category.id,
      paymentMethodId: paymentMethod.id,
      tags: [{ id: tag.id, name: tag.name }],
    });
    expect(exported.expenseCategories).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: category.id, name: category.name, archivedAt: null }),
      expect.objectContaining({ id: archivedCategory.id, name: archivedCategory.name, archivedAt: expect.any(String) }),
    ]));
    expect(exported.expenseTags).toEqual([expect.objectContaining({ id: tag.id, name: tag.name })]);
    expect(exported.paymentMethods).toEqual([expect.objectContaining({ id: paymentMethod.id, name: paymentMethod.name })]);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("sessionToken");
  });

  it("stores a one-way password verifier and closes first-user registration after success", () => {
    const previousMode = process.env.REGISTRATION_MODE;
    process.env.REGISTRATION_MODE = "first-user";
    const empty = openDatabase(":memory:");
    try {
      const app = new SqliteApplicationService(empty.db, { userId: null, clock: () => currentTime });
      const registered = app.register({ username: "new-user", password: "password123", passwordConfirmation: "password123" });
      expect(registered.user?.username).toBe("new-user");
      const stored = empty.db.select().from(users).get();
      expect(stored?.passwordHash).toBeTruthy();
      expect(stored?.passwordHash).not.toBe("password123");
      expect(() => app.register({ username: "second", password: "password123", passwordConfirmation: "password123" })).toThrow(/REGISTRATION_CLOSED/);
      app.logout();
      expect(app.login({ username: "new-user", password: "password123" }).user?.id).toBe(stored?.id);
    } finally {
      if (previousMode === undefined) delete process.env.REGISTRATION_MODE;
      else process.env.REGISTRATION_MODE = previousMode;
    }
  });

  it("honors open, closed, and invalid registration modes", () => {
    const previousMode = process.env.REGISTRATION_MODE;
    const empty = openDatabase(":memory:");
    const app = new SqliteApplicationService(empty.db, { userId: null, clock: () => currentTime });
    try {
      process.env.REGISTRATION_MODE = "open";
      expect(() => app.register({ username: "", password: "password123", passwordConfirmation: "password123" })).toThrow(/账号不能为空/);
      expect(() => app.register({ username: "weak", password: "short", passwordConfirmation: "short" })).toThrow(/PASSWORD_TOO_WEAK/);
      expect(() => app.register({ username: "mismatch", password: "password123", passwordConfirmation: "different" })).toThrow(/PASSWORD_MISMATCH/);
      expect(app.register({ username: "first", password: "password123", passwordConfirmation: "password123" }).user?.username).toBe("first");
      expect(() => app.register({ username: "first", password: "password123", passwordConfirmation: "password123" })).toThrow(/USERNAME_TAKEN/);
      expect(app.register({ username: "second", password: "password123", passwordConfirmation: "password123" }).user?.username).toBe("second");

      process.env.REGISTRATION_MODE = "closed";
      expect(app.getCapabilities().registration.available).toBe(false);
      expect(() => app.register({ username: "third", password: "password123", passwordConfirmation: "password123" })).toThrow(/REGISTRATION_CLOSED/);

      process.env.REGISTRATION_MODE = "not-a-mode";
      expect(() => app.getCapabilities()).toThrow(/Invalid REGISTRATION_MODE/);
    } finally {
      empty.sqlite.close();
      if (previousMode === undefined) delete process.env.REGISTRATION_MODE;
      else process.env.REGISTRATION_MODE = previousMode;
    }
  });

  it("validates edited amounts against recoverable cents and keeps occurrence precision coherent", () => {
    const app = service();
    const expense = app.captureExpense({ id: "expense-edit-boundaries", amountCents: 1_000 }).expense;

    expect(() => app.updateExpense(expense.id, { recoverableCents: 800, amountCents: 700 }))
      .toThrow(/预计可收回金额/);
    app.updateExpense(expense.id, { recoverableCents: 400 });
    const changedAmount = app.updateExpense(expense.id, { amountCents: 700 });
    expect(changedAmount).toMatchObject({ amountCents: 700, recoverableCents: 400 });

    const dated = app.updateExpense(expense.id, { occurredOn: "2026-06-27" });
    expect(dated).toMatchObject({ occurrencePrecision: "date", occurredOn: "2026-06-27", occurredAt: null });
    const timed = app.updateExpense(expense.id, { occurredAt: "2026-06-27T08:30:00.000Z" });
    expect(timed).toMatchObject({ occurrencePrecision: "datetime", occurredAt: "2026-06-27T08:30:00.000Z", occurredOn: null });
  });

  it("archives, restores, and merges expense dimensions transactionally", () => {
    const app = service();
    const category = app.createExpenseCategory({ name: "早餐" });
    const categoryTarget = app.createExpenseCategory({ name: "餐饮" });
    const tag = app.createExpenseTag({ name: "校园" });
    const tagTarget = app.createExpenseTag({ name: "出行" });
    const paymentMethod = app.createPaymentMethod({ name: "现金" });
    const paymentTarget = app.createPaymentMethod({ name: "支付宝" });
    const expense = app.captureExpense({ id: "expense-dimension-ops", amountCents: 1_500 }).expense;

    expect(app.renameExpenseCategory(category.id, { name: "早饭" })).toMatchObject({ name: "早饭" });
    expect(app.archiveExpenseCategory(category.id)).toMatchObject({ archivedAt: expect.any(String) });
    expect(app.restoreExpenseCategory(category.id)).toMatchObject({ archivedAt: null });
    expect(app.mergeExpenseCategory(category.id, { targetId: categoryTarget.id })).toMatchObject({ archivedAt: expect.any(String) });

    app.updateExpense(expense.id, {
      categoryId: categoryTarget.id,
      tagIds: [tag.id],
      paymentMethodId: paymentMethod.id,
      reviewStatus: "reviewed",
    });
    app.mergeExpenseTag(tag.id, { targetId: tagTarget.id });
    app.mergePaymentMethod(paymentMethod.id, { targetId: paymentTarget.id });

    const reloaded = app.getExpenseById(expense.id, { includeDeleted: true });
    expect(reloaded).toMatchObject({
      categoryId: categoryTarget.id,
      paymentMethodId: paymentTarget.id,
      tags: [{ id: tagTarget.id, name: "出行" }],
    });
    expect(app.getExpenseCategories(true).map((item) => item.id)).toContain(category.id);
    expect(app.getExpenseTags(true).map((item) => item.id)).toContain(tag.id);
    expect(app.getPaymentMethods(true).map((item) => item.id)).toContain(paymentMethod.id);
  });

  it("invalidates history cursors when merging tags changes record relations", () => {
    const app = service();
    const source = app.createExpenseTag({ name: "待合并" });
    const target = app.createExpenseTag({ name: "目标" });
    const first = app.captureExpense({ id: "tag-cursor-first", amountCents: 100 }).expense;
    const second = app.captureExpense({ id: "tag-cursor-second", amountCents: 200 }).expense;
    app.updateExpense(first.id, { tagIds: [source.id] });
    app.updateExpense(second.id, { tagIds: [source.id] });

    const page = app.getExpenseHistoryPage(1, undefined, { tagId: source.id });
    expect(page.nextCursor).toEqual(expect.any(String));
    app.mergeExpenseTag(source.id, { targetId: target.id });

    expect(() => app.getExpenseHistoryPage(1, page.nextCursor ?? undefined, { tagId: source.id }))
      .toThrow(/EXPENSE_HISTORY_STALE/);
  });
});
