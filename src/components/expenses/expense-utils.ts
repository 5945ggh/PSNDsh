import type {
  Expense,
  ExpenseCategory,
  PaymentMethod,
} from "@/lib/domain/types";
import {
  DEFAULT_TIMEZONE,
  formatDateKeyInTimezone,
  formatTimeInTimezone,
} from "@/lib/time/timezone";
export { sortExpensesForHistory } from "@/lib/expenses/history";

export type ExpenseDraft = {
  amountCents: number;
  occurrencePrecision: "datetime" | "date";
  occurredAt: string;
  occurredOn: string;
  note: string;
  categoryId: string;
  paymentMethodId: string;
  tagIds: string[];
};

export type ExpenseUpdateInput = {
  amountCents?: number;
  occurredAt?: string | null;
  occurredOn?: string | null;
  occurrencePrecision?: "datetime" | "date";
  note?: string | null;
  categoryId?: string | null;
  paymentMethodId?: string | null;
  reviewStatus?: "pending" | "reviewed";
  tagIds?: string[];
};

export const seedExpenseDraft = (expense: Expense | null): ExpenseDraft => ({
  amountCents: expense?.amountCents ?? 0,
  occurrencePrecision: expense?.occurrencePrecision ?? "datetime",
  occurredAt: expense?.occurredAt ? expense.occurredAt.slice(0, 16) : "",
  occurredOn: expense?.occurredOn ?? "",
  note: expense?.note ?? "",
  categoryId: expense?.categoryId ?? "",
  paymentMethodId: expense?.paymentMethodId ?? "",
  tagIds: expense?.tags.map((tag) => tag.id) ?? [],
});

export const expenseAmountLabel = (expense: Pick<Expense, "amountCents" | "currency">) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: expense.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(expense.amountCents / 100);

export type ExpenseDateGroup = {
  key: string;
  expenses: Expense[];
  totalCount: number;
  totalAmountCents: number;
  currency: Expense["currency"];
};

/** Returns the natural-day key used to build chronological history sections. */
export const expenseDateGroupKey = (
  expense: Pick<Expense, "occurredAt" | "occurredOn" | "occurrencePrecision">,
  timezone = DEFAULT_TIMEZONE,
) => {
  if (expense.occurrencePrecision === "date" && expense.occurredOn) return expense.occurredOn;
  const source = expense.occurredAt;
  return source ? formatDateKeyInTimezone(source, timezone) : "unknown";
};

export const formatExpenseDateGroupLabel = (dateKey: string) => {
  if (dateKey === "unknown") return "日期未知";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date(`${dateKey}T12:00:00Z`));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("month")} 月 ${part("day")} 日 · ${part("weekday")}`;
};

const formatExpenseDateRangePart = (dateKey: string) => {
  if (dateKey === "unknown") return "日期未知";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(`${dateKey}T12:00:00Z`));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("month")} 月 ${part("day")} 日`;
};

export const formatExpenseDateRangeLabel = (fromKey: string, toKey: string) =>
  fromKey === toKey
    ? formatExpenseDateGroupLabel(fromKey)
    : `${formatExpenseDateRangePart(fromKey)}—${formatExpenseDateRangePart(toKey)}`;

export const groupExpensesByDate = (
  expenses: Expense[],
  timezone = DEFAULT_TIMEZONE,
  summaryExpenses = expenses,
): ExpenseDateGroup[] => {
  const summaries = new Map<
    string,
    { totalCount: number; totalAmountCents: number; currency: Expense["currency"] }
  >();
  for (const expense of summaryExpenses) {
    const key = expenseDateGroupKey(expense, timezone);
    const current = summaries.get(key);
    summaries.set(key, {
      totalCount: (current?.totalCount ?? 0) + 1,
      totalAmountCents: (current?.totalAmountCents ?? 0) + expense.amountCents,
      currency: current?.currency ?? expense.currency,
    });
  }

  const groups = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const key = expenseDateGroupKey(expense, timezone);
    const current = groups.get(key);
    if (current) {
      current.push(expense);
    } else {
      groups.set(key, [expense]);
    }
  }

  return Array.from(groups, ([key, groupedExpenses]) => {
    const summary = summaries.get(key);
    return {
      key,
      expenses: groupedExpenses,
      totalCount: summary?.totalCount ?? groupedExpenses.length,
      totalAmountCents:
        summary?.totalAmountCents ??
        groupedExpenses.reduce((sum, expense) => sum + expense.amountCents, 0),
      currency: summary?.currency ?? groupedExpenses[0]?.currency ?? "CNY",
    };
  }).sort((left, right) => {
    if (left.key === right.key) return 0;
    if (left.key === "unknown") return 1;
    if (right.key === "unknown") return -1;
    return right.key.localeCompare(left.key);
  });
};

export const expensePrimaryText = (expense: Pick<Expense, "note" | "captureMessage">) =>
  expense.note?.trim() || expense.captureMessage?.trim() || "未填写备注";

export const expenseDisplayTagNames = (expense: Pick<Expense, "tags">) =>
  expense.tags.map((tag) => tag.name);

export const expenseCategoryLabel = (
  expense: Pick<Expense, "categoryId">,
  categories: ExpenseCategory[],
) => categories.find((category) => category.id === expense.categoryId)?.name ?? "未分类";

export const expensePaymentMethodLabel = (
  expense: Pick<Expense, "paymentMethodId">,
  paymentMethods: PaymentMethod[],
) =>
  paymentMethods.find((method) => method.id === expense.paymentMethodId)?.name ??
  "未知/未填写";

export const expenseReviewLabel = (reviewStatus: Expense["reviewStatus"]) =>
  reviewStatus === "reviewed" ? "已整理" : "待整理";

export const expenseOccurrenceLabel = (
  expense: Pick<Expense, "occurredAt" | "occurredOn" | "occurrencePrecision" | "occurredTimezone">,
  fallbackTimezone = DEFAULT_TIMEZONE,
) => {
  if (expense.occurrencePrecision === "date") {
    return expense.occurredOn ?? "发生日期未知";
  }

  const source = expense.occurredAt;
  if (!source) return "发生时间未知";
  const timezone = expense.occurredTimezone ?? fallbackTimezone;
  return `${formatDateKeyInTimezone(source, timezone)} ${formatTimeInTimezone(source, timezone)}`;
};

export const expenseRecordedLabel = (
  expense: Expense,
  fallbackTimezone = DEFAULT_TIMEZONE,
) => {
  return `记录于 ${formatDateKeyInTimezone(expense.recordedAt, fallbackTimezone)} ${formatTimeInTimezone(expense.recordedAt, fallbackTimezone)}`;
};

export const expenseQueueCounts = (expenses: Expense[]) => ({
  total: expenses.length,
  pending: expenses.filter((expense) => expense.reviewStatus === "pending").length,
  reviewed: expenses.filter((expense) => expense.reviewStatus === "reviewed").length,
  unclassified: expenses.filter((expense) => !expense.categoryId).length,
});

export const buildExpenseUpdateInput = (
  draft: ExpenseDraft,
  reviewStatus?: Expense["reviewStatus"],
): ExpenseUpdateInput => ({
  amountCents: draft.amountCents,
  occurrencePrecision: draft.occurrencePrecision,
  ...(draft.occurrencePrecision === "date"
    ? { occurredOn: draft.occurredOn || null, occurredAt: null }
    : { occurredAt: draft.occurredAt || null, occurredOn: null }),
  note: draft.note.trim() ? draft.note.trim() : null,
  categoryId: draft.categoryId || null,
  paymentMethodId: draft.paymentMethodId || null,
  ...(reviewStatus ? { reviewStatus } : {}),
  tagIds: draft.tagIds,
});

export const copyCaptureMessageToDraft = (
  draft: ExpenseDraft,
  expense: Expense | null,
): ExpenseDraft => ({
  ...draft,
  note: expense?.captureMessage?.trim() || "",
});
