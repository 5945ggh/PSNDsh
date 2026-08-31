import { describe, expect, it } from "vitest";
import { MockDataStore } from "./store";
import { MockApplicationService } from "./service";

const DEFAULT_WEEK_START = "2026-06-22";
const SELECTED_WEEK_START = "2026-07-06";

const sumDailySeconds = (daily: Array<{ seconds: number }>) =>
  daily.reduce((sum, bucket) => sum + bucket.seconds, 0);

describe("MockDataStore week plans", () => {
  it("copies the previous markdown checklist and focus intention into a new week", () => {
    const store = new MockDataStore();
    const previous = store.getWeekPlan(DEFAULT_WEEK_START);
    const next = store.getWeekPlan("2026-06-29");

    expect(next.note).toBe(previous.note);
    expect(next.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entryId: "entry_ics2",
        role: "focus",
        plannedFocusSeconds: 10800,
        source: "rollover",
      }),
    ]));
    expect(next.items.some((item) => item.entryId === "entry_hw8")).toBe(false);

    store.updateWeekPlanNote("新周清单", "2026-06-29");
    expect(store.getWeekPlan(DEFAULT_WEEK_START).note).toBe(previous.note);
  });

  it("keeps a selected non-default week isolated from the default week", () => {
    const store = new MockDataStore();
    const defaultBefore = store.getWeekPlan(DEFAULT_WEEK_START);

    const selectedFromGet = store.getWeekPlan(SELECTED_WEEK_START);
    expect(selectedFromGet).toEqual({
      weekStart: SELECTED_WEEK_START,
      note: "",
      items: [],
    });

    selectedFromGet.note = "caller mutation must not persist";
    selectedFromGet.items.push({
      entryId: "entry_ostep",
      source: "manual",
      role: "commitment",
      plannedFocusSeconds: null,
      sortKey: "caller-only",
    });
    expect(store.getWeekPlan(SELECTED_WEEK_START)).toEqual({
      weekStart: SELECTED_WEEK_START,
      note: "",
      items: [],
    });

    store.updateWeekPlanNote("selected-week note", SELECTED_WEEK_START);
    store.addToWeekPlan("entry_ostep", SELECTED_WEEK_START);
    expect(store.getWeekPlan(SELECTED_WEEK_START)).toEqual({
      weekStart: SELECTED_WEEK_START,
      note: "selected-week note",
      items: [
        expect.objectContaining({
          entryId: "entry_ostep",
          source: "manual",
          role: "commitment",
          plannedFocusSeconds: null,
        }),
      ],
    });

    store.removeFromWeekPlan("entry_ostep", SELECTED_WEEK_START);
    expect(store.getWeekPlan(SELECTED_WEEK_START)).toEqual({
      weekStart: SELECTED_WEEK_START,
      note: "selected-week note",
      items: [],
    });
    expect(store.getWeekPlan(DEFAULT_WEEK_START)).toEqual(defaultBefore);
  });

  it("reads an existing week plan without creating missing historical weeks", () => {
    const store = new MockDataStore();

    expect(store.getExistingWeekPlan(DEFAULT_WEEK_START)).toEqual(store.getWeekPlan(DEFAULT_WEEK_START));
    expect(store.getExistingWeekPlan("2026-07-06")).toBeNull();
    expect(store.getExistingWeekPlan("2026-07-06")).toBeNull();

    expect(store.getWeekPlan("2026-07-06")).toEqual({
      weekStart: "2026-07-06",
      note: "",
      items: [],
    });
  });

  it("rejects malformed or non-Monday week starts", () => {
    const store = new MockDataStore();

    expect(() => store.getExistingWeekPlan("2026-06-23")).toThrow(/REQUEST_INVALID/);
    expect(() => store.getWeekPlan("2026-02-30")).toThrow(/REQUEST_INVALID/);
  });

  it("rejects planned focus time for commitment items", () => {
    const store = new MockDataStore();

    expect(() => store.addToWeekPlan("entry_openviking", SELECTED_WEEK_START, {
      role: "commitment",
      plannedFocusSeconds: 3_600,
    })).toThrow(/REQUEST_INVALID/);

    store.addToWeekPlan("entry_openviking", SELECTED_WEEK_START, { role: "commitment" });
    expect(() => store.updateWeekPlanItem("entry_openviking", {
      role: "commitment",
      plannedFocusSeconds: 3_600,
    }, SELECTED_WEEK_START)).toThrow(/REQUEST_INVALID/);
  });

  it("rejects negative or fractional planned focus time at the service boundary", () => {
    const store = new MockDataStore();

    expect(() => store.addToWeekPlan("entry_ics2", SELECTED_WEEK_START, {
      role: "focus",
      plannedFocusSeconds: -3_600,
    })).toThrow(/REQUEST_INVALID/);
    expect(() => store.addToWeekPlan("entry_ics2", SELECTED_WEEK_START, {
      role: "focus",
      plannedFocusSeconds: 1.5,
    })).toThrow(/REQUEST_INVALID/);
  });

  it("rejects updating an item outside the selected week plan without creating it", () => {
    const store = new MockDataStore();

    expect(() => store.updateWeekPlanItem("entry_ics2", {
      role: "focus",
      plannedFocusSeconds: 3_600,
    }, SELECTED_WEEK_START)).toThrow(/WEEK_PLAN_ITEM_NOT_FOUND/);
    expect(store.getExistingWeekPlan(SELECTED_WEEK_START)).toBeNull();

    expect(() => store.updateWeekPlanItem("entry_missing", {
      role: "focus",
      plannedFocusSeconds: 3_600,
    }, DEFAULT_WEEK_START)).toThrow(/WEEK_PLAN_ITEM_NOT_FOUND/);
  });
});

describe("MockDataStore expenses", () => {
  it("keeps a newly captured unclassified expense in both Inbox and the complete list", () => {
    const store = new MockDataStore();
    const created = store.captureExpense({ id: "expense-test-1", amountCents: 1250, captureMessage: "午饭" });

    expect(created.expense.reviewStatus).toBe("pending");
    expect(store.getInboxExpenses().map((item) => item.id)).toContain("expense-test-1");
    expect(store.getExpenses().map((item) => item.id)).toContain("expense-test-1");
  });

  it("keeps deleted expense lookup behavior aligned with the persistent service", () => {
    const app = new MockApplicationService(new MockDataStore());
    const expense = app.captureExpense({ id: "expense-mock-tombstone", amountCents: 100 }).expense;
    app.deleteExpense(expense.id);

    expect(app.getExpenseById(expense.id)).toBeUndefined();
    expect(app.getExpenseById(expense.id, { includeDeleted: true })).toEqual(expect.objectContaining({
      id: expense.id,
      deletedAt: expect.any(String),
    }));
  });

  it("reviews on save or keep-original, while skip leaves Inbox membership unchanged", () => {
    const store = new MockDataStore();
    const id = store.getInboxExpenses().find((item) => !item.categoryId)?.id as string;
    expect(store.getInboxExpenses().map((item) => item.id)).toContain(id);

    store.updateExpense(id, { reviewStatus: "reviewed" });
    expect(store.getInboxExpenses().map((item) => item.id)).not.toContain(id);
    expect(store.getExpenses().find((item) => item.id === id)?.categoryId).toBeNull();

    const next = store.captureExpense({ id: "expense-test-2", amountCents: 900, captureMessage: "公交" }).expense;
    expect(store.getInboxExpenses().map((item) => item.id)).toContain(next.id);
  });

  it("preserves capture messages after copying them into the regular note and supports multiple tags", () => {
    const store = new MockDataStore();
    const expense = store.getInboxExpenses()[0];
    const tags = store.getExpenseTags();
    const saved = store.updateExpense(expense.id, { note: expense.captureMessage, tagIds: tags.map((tag) => tag.id), reviewStatus: "reviewed" });

    expect(saved.captureMessage).toBe(expense.captureMessage);
    expect(saved.note).toBe(expense.captureMessage);
    expect(saved.tags).toHaveLength(tags.length);
  });
});

describe("MockDataStore statistics", () => {
  it("returns scale-specific daily buckets and totals from the fixture sessions", () => {
    const store = new MockDataStore();
    const day = store.getStatisticsPayload("day");
    const week = store.getStatisticsPayload("week");
    const month = store.getStatisticsPayload("month");

    expect(day.daily).toHaveLength(1);
    expect(week.daily).toHaveLength(7);
    expect(month.daily).toHaveLength(30);

    expect(day.daily).toEqual([{ date: "2026-06-26", seconds: 1_800 }]);
    expect(week.daily).toEqual([
      { date: "2026-06-22", seconds: 0 },
      { date: "2026-06-23", seconds: 0 },
      { date: "2026-06-24", seconds: 8_100 },
      { date: "2026-06-25", seconds: 1_800 },
      { date: "2026-06-26", seconds: 1_800 },
      { date: "2026-06-27", seconds: 0 },
      { date: "2026-06-28", seconds: 0 },
    ]);
    expect(month.daily[11]).toEqual({ date: "2026-06-12", seconds: 4_500 });
    expect(month.daily[23]).toEqual({ date: "2026-06-24", seconds: 8_100 });
    expect(month.daily[24]).toEqual({ date: "2026-06-25", seconds: 1_800 });
    expect(month.daily[25]).toEqual({ date: "2026-06-26", seconds: 1_800 });

    expect(day.totalSeconds).toBe(1_800);
    expect(week.totalSeconds).toBe(11_700);
    expect(month.totalSeconds).toBe(16_200);
    expect(day.unassignedSeconds).toBe(1_800);
    expect(week.unassignedSeconds).toBe(3_600);
    expect(month.unassignedSeconds).toBe(3_600);
    expect(sumDailySeconds(day.daily)).toBe(day.totalSeconds);
    expect(sumDailySeconds(week.daily)).toBe(week.totalSeconds);
    expect(sumDailySeconds(month.daily)).toBe(month.totalSeconds);
    expect(day.totalSeconds).toBeLessThan(week.totalSeconds);
    expect(week.totalSeconds).toBeLessThan(month.totalSeconds);
  });

  it("returns statistics for a caller-selected Monday week", () => {
    const store = new MockDataStore();
    const selectedWeek = store.getStatisticsPayload("week", "2026-06-08");

    expect(selectedWeek.daily).toEqual([
      { date: "2026-06-08", seconds: 0 },
      { date: "2026-06-09", seconds: 0 },
      { date: "2026-06-10", seconds: 0 },
      { date: "2026-06-11", seconds: 0 },
      { date: "2026-06-12", seconds: 4_500 },
      { date: "2026-06-13", seconds: 0 },
      { date: "2026-06-14", seconds: 0 },
    ]);
    expect(selectedWeek.totalSeconds).toBe(4_500);
    expect(selectedWeek.unassignedSeconds).toBe(0);
    expect(() => store.getStatisticsPayload("day", "2026-06-22")).toThrow(/REQUEST_INVALID/);
  });

  it("keeps focus from earlier weeks out of the selected week breakdown", () => {
    const store = new MockDataStore();
    const entry = store.getEntryById("entry_ostep_fs");
    const selectedWeek = store.getStatisticsPayload("week", "2026-06-22");

    expect(entry?.aggregateFocusSeconds).toBeGreaterThan(0);
    expect(selectedWeek.entryBreakdown.find((item) => item.entryId === "entry_ostep_fs")).toMatchObject({
      directSeconds: 0,
      aggregateSeconds: 0,
    });
  });
});

describe("MockDataStore calendar", () => {
  it("updates schedules and filters both tracks by a half-open range", () => {
    const store = new MockDataStore();
    const created = store.addScheduleBlock({
      kind: "course",
      title: "跨日模拟日程",
      startedAt: "2026-06-25T23:45:00+08:00",
      endedAt: "2026-06-26T00:15:00+08:00",
      location: null,
      colorKey: "blue",
      recurrence: null,
    });
    const calendar = store.getCalendarPayload(
      "2026-06-26T00:00:00+08:00",
      "2026-06-26T01:00:00+08:00"
    );
    expect(calendar.scheduleBlocks.some((block) => block.id === created.id)).toBe(true);
    expect(calendar.focusSessions.length).toBeGreaterThan(0);
    expect(store.updateScheduleBlock(created.id, { title: "已编辑模拟日程", colorKey: "green" })).toMatchObject({
      title: "已编辑模拟日程",
      colorKey: "green",
    });
  });
});
