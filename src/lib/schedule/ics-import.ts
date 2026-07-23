import ical, { type ParameterValue, type VEvent } from "node-ical";
import { ApplicationError } from "@/lib/application/error";
import type { IcsImportPreview, IcsImportRow, ScheduleBlockInput } from "@/types/mock";

export const ICS_MAX_BYTES = 1_024 * 1_024;
export const ICS_MAX_EVENTS = 200;
export const ICS_MAX_INSTANCES = 1_000;
export const ICS_PREVIEW_WINDOW_DAYS = 180;

export type IcsImportCandidate = {
  sourceUid: string;
  blocks: ScheduleBlockInput[];
};

export type ParsedIcsImport = {
  preview: IcsImportPreview;
  candidates: IcsImportCandidate[];
};

type IcsImportOptions = {
  now?: Date;
  effectiveTimezone: string;
};

const textValue = (value: ParameterValue | undefined) =>
  typeof value === "string" ? value : value?.val ?? "";

const ianaParts = (value: Date, timezone: string) => {
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
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
};

const timezoneOffsetMs = (value: Date, timezone: string) => {
  const parts = ianaParts(value, timezone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - value.getTime();
};

const parseFloatingDate = (raw: string, timezone: string) => {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const localMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  let instant = localMs;
  for (let index = 0; index < 2; index += 1) instant = localMs - timezoneOffsetMs(new Date(instant), timezone);
  return new Date(instant);
};

const unfoldedEventProperties = (content: string) => {
  const unfolded = content.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) ?? [];
  const values = new Map<string, { start: string; end: string | null; explicitTimezone: boolean }>();
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const uid = lines.find((line) => /^UID(?:;[^:]*)?:/i.test(line))?.replace(/^UID(?:;[^:]*)?:/i, "").trim();
    const startLine = lines.find((line) => /^DTSTART(?:;[^:]*)?:/i.test(line));
    if (!uid || !startLine) continue;
    const endLine = lines.find((line) => /^DTEND(?:;[^:]*)?:/i.test(line));
    const start = startLine.slice(startLine.indexOf(":") + 1).trim();
    const end = endLine ? endLine.slice(endLine.indexOf(":") + 1).trim() : null;
    values.set(uid, { start, end, explicitTimezone: /;TZID=/i.test(startLine) || /Z$/i.test(start) });
  }
  return values;
};

const recurrenceLabel = (event: VEvent, instanceCount: number) =>
  event.rrule ? `重复事件，已展开 ${instanceCount} 次（未来 ${ICS_PREVIEW_WINDOW_DAYS} 天）` : null;

const toBlock = (event: VEvent, startedAt: Date, endedAt: Date): ScheduleBlockInput => ({
  kind: "course",
  title: textValue(event.summary).trim() || "未命名日程",
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  location: textValue(event.location).trim() || null,
  colorKey: "purple",
  recurrence: null,
});

const eventError = (event: VEvent, message: string) => ({ sourceUid: event.uid ?? null, message });

export const parseIcsImport = async (
  fileName: string,
  content: string,
  { now = new Date(), effectiveTimezone }: IcsImportOptions
): Promise<ParsedIcsImport> => {
  if (Buffer.byteLength(content, "utf8") > ICS_MAX_BYTES) throw new ApplicationError("REQUEST_INVALID", "ICS 文件不能超过 1 MiB");

  let calendar: Awaited<ReturnType<typeof ical.async.parseICS>>;
  try {
    calendar = await ical.async.parseICS(content);
  } catch {
    throw new ApplicationError("ICS_PARSE_FAILED", "ICS 文件无法解析");
  }

  const events = Object.values(calendar).filter((value): value is VEvent => value?.type === "VEVENT" && !value.recurrenceid);
  if (events.length === 0) throw new ApplicationError("ICS_PARSE_FAILED", "ICS 文件中没有可解析的日程事件");

  const properties = unfoldedEventProperties(content);
  const rows: IcsImportRow[] = [];
  const errors: IcsImportPreview["errors"] = [];
  const candidates: IcsImportCandidate[] = [];
  const horizonEnd = new Date(now.getTime() + ICS_PREVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1_000);
  let instanceCount = 0;

  for (const [index, event] of events.entries()) {
    if (index >= ICS_MAX_EVENTS) {
      errors.push({ sourceUid: null, message: `仅处理前 ${ICS_MAX_EVENTS} 个事件，其余事件未导入。` });
      break;
    }
    if (!event.uid || !event.start || !event.end) {
      errors.push(eventError(event, "事件缺少 UID、开始时间或结束时间，未导入。"));
      continue;
    }
    if (event.datetype === "date" || (event.start as Date & { dateOnly?: boolean }).dateOnly) {
      errors.push(eventError(event, "全天事件暂不支持，未导入。"));
      continue;
    }
    if (event.status === "CANCELLED") {
      errors.push(eventError(event, "已取消事件未导入。"));
      continue;
    }
    const raw = properties.get(event.uid);
    if (!raw) {
      errors.push(eventError(event, "无法读取事件时间字段，未导入。"));
      continue;
    }
    if (event.rrule && !raw.explicitTimezone) {
      errors.push(eventError(event, "重复事件必须使用 UTC 或 TZID 时区，未导入。"));
      continue;
    }

    let blocks: ScheduleBlockInput[];
    if (event.rrule) {
      const instances = ical.expandRecurringEvent(event, { from: now, to: horizonEnd, includeOverrides: true, excludeExdates: true });
      if (instances.some((instance) => instance.isFullDay)) {
        errors.push(eventError(event, "重复规则包含全天实例，未导入。"));
        continue;
      }
      blocks = instances.map((instance) => toBlock(instance.event, new Date(instance.start), new Date(instance.end)));
      if (blocks.length === 0) {
        errors.push(eventError(event, `重复事件在未来 ${ICS_PREVIEW_WINDOW_DAYS} 天内没有实例，未导入。`));
        continue;
      }
    } else {
      const startedAt = raw.explicitTimezone ? new Date(event.start) : parseFloatingDate(raw.start, effectiveTimezone);
      const endedAt = raw.explicitTimezone ? new Date(event.end) : raw.end ? parseFloatingDate(raw.end, effectiveTimezone) : null;
      if (!startedAt || !endedAt) {
        errors.push(eventError(event, "无时区事件的时间格式无效，未导入。"));
        continue;
      }
      blocks = [toBlock(event, startedAt, endedAt)];
    }
    if (blocks.some((block) => Date.parse(block.endedAt) <= Date.parse(block.startedAt))) {
      errors.push(eventError(event, "结束时间必须晚于开始时间，未导入。"));
      continue;
    }
    if (instanceCount + blocks.length > ICS_MAX_INSTANCES) {
      errors.push(eventError(event, `展开后的日程不能超过 ${ICS_MAX_INSTANCES} 项，未导入。`));
      continue;
    }
    instanceCount += blocks.length;
    const first = blocks[0]!;
    rows.push({
      sourceUid: event.uid,
      title: first.title,
      startedAt: first.startedAt,
      endedAt: first.endedAt,
      recurrenceLabel: recurrenceLabel(event, blocks.length),
      selected: true,
      warnings: event.rrule ? [`将写入 ${blocks.length} 个未来实例；窗口外的重复不会自动延续。`] : [],
    });
    candidates.push({ sourceUid: event.uid, blocks });
  }

  return { preview: { importId: "", fileName, rows, errors }, candidates };
};
