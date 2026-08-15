import { ApplicationError } from "@/lib/application/error";
import { WeekPlanItemInput } from "@/lib/domain/types";

export const assertValidWeekPlanItemInput = (input: WeekPlanItemInput) => {
  if (input.role === "commitment" && input.plannedFocusSeconds !== null) {
    throw new ApplicationError(
      "REQUEST_INVALID",
      "commitment 条目不能设置预计投入时间",
    );
  }
  if (
    input.plannedFocusSeconds !== null &&
    (!Number.isSafeInteger(input.plannedFocusSeconds) || input.plannedFocusSeconds < 0)
  ) {
    throw new ApplicationError(
      "REQUEST_INVALID",
      "预计投入时间必须是非负整数秒",
    );
  }
};

export type WeekStartIssue = "format" | "not-exists" | "not-monday";

export const WEEK_START_MESSAGES: Record<WeekStartIssue, string> = {
  format: "周起始日期必须是 YYYY-MM-DD",
  "not-exists": "周起始日期不存在",
  "not-monday": "周起始日期必须是周一",
};

/**
 * 校验周起始日期是否为合法、真实存在且是周一的 YYYY-MM-DD。
 * 返回 null 表示有效，否则返回具体问题，由调用方决定抛出的错误类型。
 */
export const parseWeekStart = (value: string): WeekStartIssue | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "format";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) return "not-exists";
  if (date.getUTCDay() !== 1) return "not-monday";
  return null;
};

// 本周预计投入的快捷档位（小时）。下拉框以秒数为内部值，避免历史值（例如
// 2 小时、1.5 小时）换算成小时字符串后与预设档位对不上，导致受控 <select>
// 渲染为空白。
export const PLANNED_FOCUS_HOUR_OPTIONS = [1, 3, 5, 8, 10];

export const plannedFocusSelectValue = (plannedFocusSeconds: number | null): string =>
  plannedFocusSeconds === null ? "" : String(plannedFocusSeconds);

export const plannedFocusOptionValues = (plannedFocusSeconds: number | null): string[] => {
  const values = PLANNED_FOCUS_HOUR_OPTIONS.map((hours) => String(hours * 3600));
  if (plannedFocusSeconds !== null) {
    const current = String(plannedFocusSeconds);
    if (!values.includes(current)) values.push(current);
  }
  return values;
};
