import type { ExpenseDataExport } from "@/lib/domain/types";

const columns = [
  "id", "amountCents", "currency", "occurredAt", "occurredOn", "occurredTimezone",
  "occurrencePrecision", "recordedAt", "captureMessage", "note", "categoryId", "categoryName",
  "paymentMethodId", "paymentMethodName", "tagIds", "tagNames", "reviewStatus", "recognitionStatus",
  "recoverableCents", "settled", "source", "latitude", "longitude", "deletedAt", "createdAt", "updatedAt",
] as const;

const escapeCsv = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const expenseCsvColumns = columns;

export const serializeExpenseCsv = (data: ExpenseDataExport) => {
  const categoryNames = new Map(data.expenseCategories.map((item) => [item.id, item.name] as const));
  const paymentMethodNames = new Map(data.paymentMethods.map((item) => [item.id, item.name] as const));
  const rows = data.expenses.map((expense) => [
    expense.id,
    expense.amountCents,
    expense.currency,
    expense.occurredAt,
    expense.occurredOn,
    expense.occurredTimezone,
    expense.occurrencePrecision,
    expense.recordedAt,
    expense.captureMessage,
    expense.note,
    expense.categoryId,
    expense.categoryName ?? (expense.categoryId ? categoryNames.get(expense.categoryId) : null),
    expense.paymentMethodId,
    expense.paymentMethodName ?? (expense.paymentMethodId ? paymentMethodNames.get(expense.paymentMethodId) : null),
    expense.tags.map((tag) => tag.id).join(","),
    expense.tags.map((tag) => tag.name).join(","),
    expense.reviewStatus,
    expense.recognitionStatus,
    expense.recoverableCents,
    expense.settled,
    expense.source,
    expense.latitude,
    expense.longitude,
    expense.deletedAt,
    expense.createdAt,
    expense.updatedAt,
  ].map(escapeCsv).join(","));
  return [columns.join(","), ...rows].join("\r\n") + "\r\n";
};
