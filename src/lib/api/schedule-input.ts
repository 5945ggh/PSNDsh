import { z } from "zod";

const isoTimestamp = z.string().refine(
  (value) => Number.isFinite(Date.parse(value)),
  "必须是有效的 ISO 时间"
);

const recurrence = z.object({
  frequency: z.literal("weekly"),
  interval: z.number().int().positive(),
  weekdays: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])),
  until: z.string().nullable(),
}).nullable();

const scheduleFields = z.object({
  kind: z.enum(["course", "plan", "other"]),
  title: z.string().trim().min(1, "标题不能为空"),
  description: z.string().trim().max(4_000).nullable().optional(),
  startedAt: isoTimestamp,
  endedAt: isoTimestamp,
  location: z.string().nullable(),
  colorKey: z.string().nullable(),
  recurrence,
});

export const scheduleInput = scheduleFields.refine(
  (input) => Date.parse(input.endedAt) > Date.parse(input.startedAt),
  { message: "结束时间必须晚于开始时间", path: ["endedAt"] }
);

export const updateScheduleInput = scheduleFields.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: "至少提供一个要修改的字段" }
);

export const calendarRangeInput = z.object({
  from: isoTimestamp.optional(),
  to: isoTimestamp.optional(),
}).refine(
  ({ from, to }) => Boolean(from) === Boolean(to),
  { message: "from 和 to 必须同时提供" }
).refine(
  ({ from, to }) => !from || !to || Date.parse(to) > Date.parse(from),
  { message: "to 必须晚于 from", path: ["to"] }
);
