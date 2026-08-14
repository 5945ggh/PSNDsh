import { describe, expect, it } from "vitest";
import { getCalendarHourOffset, getShanghaiDecimalHour } from "./calendar-utils";

describe("calendar time axis", () => {
  it("starts at 06:00 and continues through midnight to 05:00", () => {
    expect(getCalendarHourOffset(new Date("2026-07-28T06:00:00+08:00"))).toBe(0);
    expect(getCalendarHourOffset(new Date("2026-07-28T23:00:00+08:00"))).toBe(17);
    expect(getCalendarHourOffset(new Date("2026-07-28T00:00:00+08:00"))).toBe(18);
    expect(getCalendarHourOffset(new Date("2026-07-28T05:00:00+08:00"))).toBe(23);
  });

  it("keeps seconds when positioning a focus shorter than one minute", () => {
    const startedAt = new Date("2026-07-28T10:20:05+08:00");
    const endedAt = new Date("2026-07-28T10:20:40+08:00");

    expect(getShanghaiDecimalHour(endedAt)).toBeGreaterThan(getShanghaiDecimalHour(startedAt));
    expect(getCalendarHourOffset(endedAt)).toBeGreaterThan(getCalendarHourOffset(startedAt));
  });
});
