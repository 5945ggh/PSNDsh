export const DEFAULT_TIMEZONE = "Asia/Shanghai";

const dateFor = (value: Date | string | number) =>
  value instanceof Date ? value : new Date(value);

export const formatTimeInTimezone = (value: Date | string | number, timezone: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
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
