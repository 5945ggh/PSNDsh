import { describe, expect, it } from "vitest";
import {
  adjustPlannedFocusSeconds,
  assertValidWeekPlanItemInput,
  parseWeekStart,
  PLANNED_FOCUS_STEP_SECONDS,
  WEEK_START_MESSAGES,
} from "./week-plan";

describe("parseWeekStart", () => {
  it("accepts a real Monday", () => {
    expect(parseWeekStart("2026-06-22")).toBeNull();
    expect(parseWeekStart("2026-06-29")).toBeNull();
  });

  it("rejects malformed, non-existent, and non-Monday dates", () => {
    expect(parseWeekStart("2026/06/22")).toBe("format");
    expect(parseWeekStart("2026-02-30")).toBe("not-exists");
    expect(parseWeekStart("2026-06-23")).toBe("not-monday");
    expect(parseWeekStart("2026-06-28")).toBe("not-monday");
  });

  it("maps every issue to a readable message", () => {
    for (const issue of ["format", "not-exists", "not-monday"] as const) {
      expect(WEEK_START_MESSAGES[issue]).toBeTruthy();
    }
  });
});

describe("planned focus stepper", () => {
  it("increases from unset in 30-minute steps", () => {
    expect(PLANNED_FOCUS_STEP_SECONDS).toBe(1800);
    expect(adjustPlannedFocusSeconds(null, "increase")).toBe(1800);
    expect(adjustPlannedFocusSeconds(1800, "increase")).toBe(3600);
    expect(adjustPlannedFocusSeconds(5400, "increase")).toBe(7200);
  });

  it("returns to unset after decrementing the smallest step", () => {
    expect(adjustPlannedFocusSeconds(null, "decrease")).toBeNull();
    expect(adjustPlannedFocusSeconds(1800, "decrease")).toBeNull();
    expect(adjustPlannedFocusSeconds(3600, "decrease")).toBe(1800);
  });

  it("preserves nonstandard historical values while adjusting them", () => {
    expect(adjustPlannedFocusSeconds(12345, "increase")).toBe(14145);
    expect(adjustPlannedFocusSeconds(12345, "decrease")).toBe(10545);
  });
});

describe("assertValidWeekPlanItemInput", () => {
  it("rejects commitment items carrying planned focus time", () => {
    expect(() => assertValidWeekPlanItemInput({ role: "commitment", plannedFocusSeconds: 3600 }))
      .toThrow(/不能设置预计投入时间/);
  });

  it("rejects negative or fractional planned focus time", () => {
    expect(() => assertValidWeekPlanItemInput({ role: "focus", plannedFocusSeconds: -3600 }))
      .toThrow(/非负整数秒/);
    expect(() => assertValidWeekPlanItemInput({ role: "focus", plannedFocusSeconds: 1.5 }))
      .toThrow(/非负整数秒/);
  });

  it("accepts null and non-negative integer planned focus time", () => {
    expect(() => assertValidWeekPlanItemInput({ role: "focus", plannedFocusSeconds: null })).not.toThrow();
    expect(() => assertValidWeekPlanItemInput({ role: "focus", plannedFocusSeconds: 0 })).not.toThrow();
    expect(() => assertValidWeekPlanItemInput({ role: "focus", plannedFocusSeconds: 7200 })).not.toThrow();
    expect(() => assertValidWeekPlanItemInput({ role: "commitment", plannedFocusSeconds: null })).not.toThrow();
  });
});
