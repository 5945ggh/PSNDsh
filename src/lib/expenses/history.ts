import type { Expense } from "@/lib/domain/types";
import { ApplicationError } from "@/lib/application/error";
import { DEFAULT_TIMEZONE, formatDateKeyInTimezone } from "@/lib/time/timezone";

export type ExpenseHistoryPage = {
  items: Expense[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ExpenseHistoryFields = Pick<
  Expense,
  "id" | "occurredAt" | "occurredOn" | "occurrencePrecision" | "updatedAt" | "createdAt" | "recordedAt"
>;

export type ExpenseHistoryCursor = {
  dateKey: string;
  occurredAtMs: number;
  fallbackMs: number;
  id: string;
  revision?: string;
};

const parsedTime = (value: string | null | undefined) => {
  if (!value) return 0;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : 0;
};

export const expenseHistorySortKey = (
  expense: ExpenseHistoryFields,
  timezone = DEFAULT_TIMEZONE,
): ExpenseHistoryCursor => ({
  dateKey:
    expense.occurrencePrecision === "date" && expense.occurredOn
      ? expense.occurredOn
      : expense.occurredAt
        ? formatDateKeyInTimezone(expense.occurredAt, timezone)
        : "0000-00-00",
  occurredAtMs: expense.occurrencePrecision === "date" ? 0 : parsedTime(expense.occurredAt),
  fallbackMs: parsedTime(
    expense.occurrencePrecision === "datetime"
      ? (expense.createdAt ?? expense.recordedAt)
      : (expense.updatedAt ?? expense.createdAt ?? expense.recordedAt),
  ),
  id: expense.id,
});

export const compareExpenseHistoryKeys = (
  left: ExpenseHistoryCursor,
  right: ExpenseHistoryCursor,
) => {
  if (left.dateKey !== right.dateKey) {
    if (left.dateKey === "unknown") return 1;
    if (right.dateKey === "unknown") return -1;
    return right.dateKey.localeCompare(left.dateKey);
  }
  if (left.occurredAtMs !== right.occurredAtMs) return right.occurredAtMs - left.occurredAtMs;
  if (left.fallbackMs !== right.fallbackMs) return right.fallbackMs - left.fallbackMs;
  return left.id.localeCompare(right.id);
};

export const sortExpensesForHistory = <T extends ExpenseHistoryFields>(
  expenses: T[],
  timezone = DEFAULT_TIMEZONE,
) =>
  [...expenses].sort((left, right) =>
    compareExpenseHistoryKeys(expenseHistorySortKey(left, timezone), expenseHistorySortKey(right, timezone)),
  );

const encodeCursor = (cursor: ExpenseHistoryCursor) => {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
};

export const decodeExpenseHistoryCursor = (value: string): ExpenseHistoryCursor | null => {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ExpenseHistoryCursor>;
    if (
      typeof parsed.dateKey !== "string" ||
      typeof parsed.occurredAtMs !== "number" ||
      typeof parsed.fallbackMs !== "number" ||
      typeof parsed.id !== "string"
    ) return null;
    return parsed as ExpenseHistoryCursor;
  } catch {
    return null;
  }
};

export const createExpenseHistoryCursor = (
  expense: ExpenseHistoryFields,
  timezone = DEFAULT_TIMEZONE,
  revision?: string,
) => encodeCursor({ ...expenseHistorySortKey(expense, timezone), ...(revision ? { revision } : {}) });

export const getExpenseHistoryPage = (
  expenses: Expense[],
  timezone = DEFAULT_TIMEZONE,
  limit = 25,
  before?: string,
  revision?: string,
): ExpenseHistoryPage => {
  const ordered = sortExpensesForHistory(expenses, timezone);
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  let startIndex = 0;
  if (before) {
    const cursor = decodeExpenseHistoryCursor(before);
    if (!cursor) throw new ApplicationError("REQUEST_INVALID", "开销历史游标无效");
    const index = ordered.findIndex((expense) =>
      compareExpenseHistoryKeys(expenseHistorySortKey(expense, timezone), cursor) > 0,
    );
    startIndex = index < 0 ? ordered.length : index;
  }
  const items = ordered.slice(startIndex, startIndex + boundedLimit);
  const hasMore = startIndex + items.length < ordered.length;
  return {
    items,
    nextCursor: hasMore ? createExpenseHistoryCursor(items[items.length - 1]!, timezone, revision) : null,
    hasMore,
  };
};
