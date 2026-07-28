export const DEFAULT_TIMEZONE = "Asia/Shanghai";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dateFor = (value: Date | string | number) =>
  value instanceof Date ? value : new Date(value);

const partsInTimezone = (value: Date, timezone: string): DateParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

const timezoneOffsetMs = (value: Date, timezone: string) => {
  const parts = partsInTimezone(value, timezone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - value.getTime();
};

const localDateTimeToDate = (value: string, timezone: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const localMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  let instant = localMs;
  for (let index = 0; index < 2; index += 1) instant = localMs - timezoneOffsetMs(new Date(instant), timezone);
  return new Date(instant);
};

export const localDateTimeToIso = (value: string, timezone = DEFAULT_TIMEZONE) =>
  localDateTimeToDate(value, timezone)?.toISOString() ?? null;

export const dateKeyToEndOfDayIso = (dateKey: string, timezone = DEFAULT_TIMEZONE) =>
  localDateTimeToIso(`${dateKey}T23:59:59`, timezone);

const shiftDateKey = (dateKey: string, days: number) => {
  const value = new Date(`${dateKey}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export type DeadlineStatus = "overdue" | "upcoming" | null;

export const deadlineStatusInTimezone = (
  dueAt: string | null,
  now: Date | string | number,
  timezone = DEFAULT_TIMEZONE,
  upcomingDays = 3,
): DeadlineStatus => {
  if (!dueAt) return null;
  const dueMs = Date.parse(dueAt);
  const nowDate = dateFor(now);
  if (!Number.isFinite(dueMs) || !Number.isFinite(nowDate.getTime())) return null;
  if (dueMs <= nowDate.getTime()) return "overdue";

  const todayKey = formatDateKeyInTimezone(nowDate, timezone);
  const dueKey = formatDateKeyInTimezone(new Date(dueMs), timezone);
  let distance = 0;
  let cursor = todayKey;
  while (cursor !== dueKey && distance <= upcomingDays) {
    cursor = shiftDateKey(cursor, 1);
    distance += 1;
  }
  return cursor === dueKey && distance <= upcomingDays ? "upcoming" : null;
};

export const formatTimeInTimezone = (value: Date | string | number, timezone: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(dateFor(value));

export const formatDateKeyInTimezone = (value: Date | string | number, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(dateFor(value));

export const getHourInTimezone = (value: Date | string | number, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(dateFor(value));
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
};

export const greetingForHour = (hour: number) => {
  if (hour < 5 || hour >= 18) return "晚上好";
  if (hour < 12) return "早安";
  return "下午好";
};

export const formatDateLabelInTimezone = (value: Date | string | number, timezone: string) => {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
  }).formatToParts(dateFor(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}年${part("month")}月${part("day")}日 ${part("weekday")}`;
};
