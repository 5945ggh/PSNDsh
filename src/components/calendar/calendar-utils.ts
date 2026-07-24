import type { FocusSession, ScheduleBlock } from "@/lib/domain/types";

export const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
export const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

const shanghaiTimePartsFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: SHANGHAI_TIME_ZONE,
});

export type CalendarDay = {
  date: string;
  dayName: string;
};

export type Ranged<T> = {
  item: T;
  range: { startMs: number; endMs: number };
};

export const scheduleAccentColor = (colorKey: string | null) => {
  const colors: Record<string, string> = {
    blue: "#2563eb",
    green: "#059669",
    amber: "#d97706",
    rose: "#e11d48",
  };
  return colors[colorKey ?? "blue"] ?? colors.blue;
};

export const currentShanghaiWeekStart = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const current = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const weekday = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() - weekday + 1);
  return current.toISOString().slice(0, 10);
};

export const shiftDateKey = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const weekDaysFor = (weekStart: string): CalendarDay[] =>
  Array.from({ length: 7 }, (_, index) => ({
    date: shiftDateKey(weekStart, index),
    dayName: `周${["一", "二", "三", "四", "五", "六", "日"][index]}`,
  }));

export const overlapRange = (date: string, startedAt: string, endedAt: string) => {
  const dayStartMs = Date.parse(`${date}T00:00:00+08:00`);
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const overlapStart = Math.max(Date.parse(startedAt), dayStartMs);
  const overlapEnd = Math.min(Date.parse(endedAt), dayEndMs);
  if (overlapEnd <= overlapStart) return null;
  return { startMs: overlapStart, endMs: overlapEnd };
};

export const getShanghaiDecimalHour = (value: Date) => {
  const parts = shanghaiTimePartsFormatter.formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour + minute / 60;
};

export const getPopoverPositionClass = (topPx: number, dayIdx: number) => {
  const verticalClass = topPx < 90 ? "top-full mt-2" : "bottom-full mb-2";
  const horizontalClass = dayIdx <= 1 ? "left-0 translate-x-0" : dayIdx >= 5 ? "right-0 translate-x-0" : "left-1/2 -translate-x-1/2";
  return `${verticalClass} ${horizontalClass}`;
};

export const rangeSchedulesForDay = (date: string, schedules: ScheduleBlock[]): Ranged<ScheduleBlock>[] =>
  schedules.flatMap((schedule) => {
    const range = overlapRange(date, schedule.startedAt, schedule.endedAt);
    return range ? [{ item: schedule, range }] : [];
  });

export const rangeFocusesForDay = (date: string, focuses: FocusSession[], now = new Date().toISOString()): Ranged<FocusSession>[] =>
  focuses.flatMap((focus) => {
    const range = overlapRange(date, focus.startedAt, focus.endedAt || now);
    return range ? [{ item: focus, range }] : [];
  });
