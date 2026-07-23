import { z } from "zod";

const weekdays = z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]))
  .min(1, "至少选择一天")
  .max(7)
  .refine((values) => new Set(values).size === values.length, "星期不能重复");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "时间格式必须为 HH:mm");

const templateItem = z.object({
  weekdays,
  title: z.string().trim().min(1, "标题不能为空").max(200),
  description: z.string().trim().max(4_000).nullable().optional(),
  kind: z.enum(["course", "plan", "other"]),
  location: z.string().trim().max(200).nullable().optional(),
  colorKey: z.string().trim().max(40).nullable().optional(),
  startTime: time,
  endTime: time,
});

export const scheduleTemplateInput = z.object({
  name: z.string().trim().min(1, "模板名称不能为空").max(120),
  description: z.string().trim().max(4_000).nullable().optional(),
  items: z.array(templateItem).min(1, "模板至少需要一个日程项").max(200),
}).strict();

export const scheduleTemplateDateRangeInput = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "开始日期格式无效"),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "结束日期格式无效"),
}).strict().refine(({ fromDate, toDate }) => toDate >= fromDate, {
  message: "结束日期不能早于开始日期",
  path: ["toDate"],
}).refine(({ fromDate, toDate }) => {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) && (to - from) / 86_400_000 <= 366;
}, { message: "一次最多应用 366 天", path: ["toDate"] });
