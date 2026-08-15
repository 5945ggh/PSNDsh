import { describe, expect, it } from "vitest";
import {
  assertValidWeekPlanItemInput,
  parseWeekStart,
  plannedFocusOptionValues,
  plannedFocusSelectValue,
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

describe("planned focus select", () => {
  it("always offers an option matching the current select value", () => {
    for (const seconds of [null, 0, 3600, 5400, 7200, 10800, 12345]) {
      const value = plannedFocusSelectValue(seconds);
      const options = plannedFocusOptionValues(seconds);
      if (value === "") {
        expect(options).not.toContain("");
      } else {
        expect(options).toContain(value);
      }
    }
  });

  it("lists preset hour options as second values", () => {
    expect(plannedFocusOptionValues(null)).toEqual(["3600", "10800", "18000", "28800", "36000"]);
  });

  it("appends the current value when it is not a preset", () => {
    const options = plannedFocusOptionValues(5400);
    expect(options).toContain("5400");
    expect(options).toHaveLength(6); // 5 presets + current value
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
