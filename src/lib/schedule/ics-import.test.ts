import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApplicationError } from "@/lib/application/error";
import { parseIcsImport } from "./ics-import";

const fixture = (name: string) => fs.readFileSync(path.join(process.cwd(), "src/lib/schedule/fixtures", name), "utf8");
const at = (value: string) => new Date(value);

describe("parseIcsImport", () => {
  it("expands timezone-aware recurrence with DST, EXDATE, and RECURRENCE-ID overrides", async () => {
    const parsed = await parseIcsImport(
      "course.ics",
      fixture("recurrence-and-exceptions.ics"),
      { now: at("2026-03-01T00:00:00.000Z"), effectiveTimezone: "Asia/Shanghai" }
    );

    expect(parsed.preview.rows).toEqual([expect.objectContaining({
      sourceUid: "new-york-course",
      title: "时区课程",
      recurrenceLabel: expect.stringContaining("已展开 3 次"),
    })]);
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]?.blocks).toEqual([
      expect.objectContaining({ startedAt: "2026-03-02T14:00:00.000Z", endedAt: "2026-03-02T15:00:00.000Z", location: "Room 101" }),
      expect.objectContaining({ startedAt: "2026-03-16T14:00:00.000Z", endedAt: "2026-03-16T15:00:00.000Z", title: "时区课程（调课）", location: "Room 102" }),
      expect.objectContaining({ startedAt: "2026-03-23T13:00:00.000Z", endedAt: "2026-03-23T14:00:00.000Z", location: "Room 101" }),
    ]);
  });

  it("uses effectiveTimezone for a single floating event", async () => {
    const parsed = await parseIcsImport("floating.ics", `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:floating-event
DTSTAMP:20260722T000000Z
DTSTART:20260723T090000
DTEND:20260723T100000
SUMMARY:本地单次日程
END:VEVENT
END:VCALENDAR`, { effectiveTimezone: "Asia/Shanghai" });

    expect(parsed.candidates[0]?.blocks[0]).toMatchObject({
      startedAt: "2026-07-23T01:00:00.000Z",
      endedAt: "2026-07-23T02:00:00.000Z",
    });
  });

  it("filters all-day and floating recurring events instead of silently changing their semantics", async () => {
    const parsed = await parseIcsImport("unsupported.ics", `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day
DTSTAMP:20260722T000000Z
DTSTART;VALUE=DATE:20260723
DTEND;VALUE=DATE:20260724
SUMMARY:全天活动
END:VEVENT
BEGIN:VEVENT
UID:floating-recurring
DTSTAMP:20260722T000000Z
DTSTART:20260723T090000
DTEND:20260723T100000
RRULE:FREQ=WEEKLY;COUNT=2
SUMMARY:浮动重复
END:VEVENT
END:VCALENDAR`, { effectiveTimezone: "Asia/Shanghai" });

    expect(parsed.preview.rows).toHaveLength(0);
    expect(parsed.preview.errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      expect.stringContaining("全天事件"),
      expect.stringContaining("必须使用 UTC 或 TZID"),
    ]));
  });

  it("rejects malformed input with a stable domain error", async () => {
    await expect(parseIcsImport("bad.ics", "not a calendar", { effectiveTimezone: "Asia/Shanghai" }))
      .rejects.toMatchObject<ApplicationError>({ code: "ICS_PARSE_FAILED" });
  });
});
