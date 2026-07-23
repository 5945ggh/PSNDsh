import { describe, expect, it } from "vitest";
import { MockDataStore } from "./store";

const DEFAULT_WEEK_START = "2026-06-22";
const SELECTED_WEEK_START = "2026-07-06";

const sumDailySeconds = (daily: Array<{ seconds: number }>) =>
  daily.reduce((sum, bucket) => sum + bucket.seconds, 0);

describe("MockDataStore week plans", () => {
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
