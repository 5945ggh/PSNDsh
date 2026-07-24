import { describe, expect, it } from "vitest";
import {
  formatDateKeyInTimezone,
  formatDateLabelInTimezone,
  formatTimeInTimezone,
  getHourInTimezone,
  greetingForHour,
} from "./timezone";

describe("timezone formatting", () => {
  it("formats persisted UTC timestamps in the effective local timezone", () => {
    const timestamp = "2026-07-23T00:50:00.000Z";

    expect(formatTimeInTimezone(timestamp, "Asia/Shanghai")).toBe("08:50");
    expect(getHourInTimezone(timestamp, "Asia/Shanghai")).toBe(8);
    expect(formatDateKeyInTimezone(timestamp, "Asia/Shanghai")).toBe("2026-07-23");
    expect(formatDateLabelInTimezone(timestamp, "Asia/Shanghai")).toContain("2026年7月23日");
  });

  it("uses the expected greeting for each time-of-day boundary", () => {
    expect(greetingForHour(4)).toBe("晚上好");
    expect(greetingForHour(5)).toBe("早安");
    expect(greetingForHour(11)).toBe("早安");
    expect(greetingForHour(12)).toBe("下午好");
    expect(greetingForHour(17)).toBe("下午好");
    expect(greetingForHour(18)).toBe("晚上好");
    expect(greetingForHour(23)).toBe("晚上好");
  });
});
