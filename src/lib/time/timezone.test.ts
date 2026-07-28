import { describe, expect, it } from "vitest";
import {
  dateKeyToEndOfDayIso,
  deadlineStatusInTimezone,
  formatDateKeyInTimezone,
  formatDateLabelInTimezone,
  formatTimeInTimezone,
  getHourInTimezone,
  greetingForHour,
  localDateTimeToIso,
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

  it("converts local Shanghai input to an instant without losing the wall-clock time", () => {
    expect(localDateTimeToIso("2026-07-26T09:30", "Asia/Shanghai")).toBe("2026-07-26T01:30:00.000Z");
    expect(dateKeyToEndOfDayIso("2026-07-26", "Asia/Shanghai")).toBe("2026-07-26T15:59:59.000Z");
    expect(formatDateKeyInTimezone("2026-07-26T15:59:59.000Z", "Asia/Shanghai")).toBe("2026-07-26");
    expect(formatTimeInTimezone("2026-07-26T15:59:59.000Z", "Asia/Shanghai")).toBe("23:59");
  });

  it("marks only overdue or upcoming dates within the three-day window", () => {
    const now = "2026-07-26T04:00:00.000Z"; // 12:00 Asia/Shanghai
    expect(deadlineStatusInTimezone("2026-07-25T15:59:59.000Z", now, "Asia/Shanghai")).toBe("overdue");
    expect(deadlineStatusInTimezone("2026-07-26T15:59:59.000Z", now, "Asia/Shanghai")).toBe("upcoming");
    expect(deadlineStatusInTimezone("2026-07-29T15:59:59.000Z", now, "Asia/Shanghai")).toBe("upcoming");
    expect(deadlineStatusInTimezone("2026-07-30T15:59:59.000Z", now, "Asia/Shanghai")).toBeNull();
  });
});
