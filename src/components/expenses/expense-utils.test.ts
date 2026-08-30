import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/domain/types";
import {
  buildExpenseUpdateInput,
  copyCaptureMessageToDraft,
  expenseQueueCounts,
  expensePrimaryText,
  formatExpenseDateGroupLabel,
  formatExpenseDateRangeLabel,
  groupExpensesByDate,
  seedExpenseDraft,
} from "./expense-utils";

const sampleExpense = (overrides: Partial<Expense> = {}): Expense =>
  ({
    id: "expense-1",
    amountCents: 1250,
    currency: "CNY",
    occurredAt: "2026-08-27T09:30:00+08:00",
    occurredOn: null,
    occurredTimezone: "Asia/Shanghai",
    occurrencePrecision: "datetime",
    recordedAt: "2026-08-27T09:31:00+08:00",
    captureMessage: "午饭",
    note: null,
    categoryId: null,
    paymentMethodId: null,
    tags: [],
    reviewStatus: "pending",
    recognitionStatus: "recognized",
    recoverableCents: 0,
    settled: false,
    source: "shortcut",
    latitude: null,
    longitude: null,
    deletedAt: null,
    createdAt: "2026-08-27T09:31:00+08:00",
    updatedAt: "2026-08-27T09:31:00+08:00",
    ...overrides,
  }) satisfies Expense;

describe("expense-utils", () => {
  it("prefers note, then capture message, then neutral placeholder", () => {
    expect(expensePrimaryText(sampleExpense())).toBe("午饭");
    expect(expensePrimaryText(sampleExpense({ note: "整理后的备注" }))).toBe("整理后的备注");
    expect(expensePrimaryText(sampleExpense({ captureMessage: null }))).toBe("未填写备注");
  });

  it("keeps capture messages when copying into a draft and building update input", () => {
    const draft = seedExpenseDraft(sampleExpense());
    const copied = copyCaptureMessageToDraft(draft, sampleExpense());

    expect(copied.note).toBe("午饭");
    expect(sampleExpense().captureMessage).toBe("午饭");
    expect(buildExpenseUpdateInput(copied, "reviewed")).toEqual({
      amountCents: 1250,
      occurredAt: "2026-08-27T09:30",
      occurredOn: null,
      occurrencePrecision: "datetime",
      note: "午饭",
      categoryId: null,
      paymentMethodId: null,
      reviewStatus: "reviewed",
      tagIds: [],
    });
  });

  it("summarizes pending and unclassified counts independently", () => {
    expect(
      expenseQueueCounts([
        sampleExpense(),
        sampleExpense({ id: "expense-2", reviewStatus: "reviewed", categoryId: "cat-1" }),
      ]),
    ).toEqual({ total: 2, pending: 1, reviewed: 1, unclassified: 1 });
  });

  it("groups datetime records by the effective timezone and summarizes each day", () => {
    const groups = groupExpensesByDate(
      [
        sampleExpense({ id: "late", amountCents: 500, occurredAt: "2026-08-30T23:30:00.000Z" }),
        sampleExpense({ id: "early", amountCents: 1250, occurredAt: "2026-08-30T00:30:00.000Z" }),
        sampleExpense({ id: "previous", amountCents: 300, occurredAt: "2026-08-29T23:59:00.000Z" }),
      ],
      "Asia/Shanghai",
    );

    expect(groups.map((group) => group.key)).toEqual(["2026-08-31", "2026-08-30"]);
    expect(groups[0]).toMatchObject({ totalCount: 1, totalAmountCents: 500, currency: "CNY" });
    expect(groups[0]?.expenses.map((item) => item.id)).toEqual(["late"]);
    expect(groups[1]).toMatchObject({ totalCount: 2, totalAmountCents: 1550, currency: "CNY" });
    expect(groups[1]?.expenses.map((item) => item.id)).toEqual(["early", "previous"]);
  });

  it("uses occurredOn for date-precision records and formats a compact Chinese header", () => {
    const groups = groupExpensesByDate([
      sampleExpense({
        id: "date-only",
        amountCents: 520,
        occurrencePrecision: "date",
        occurredAt: null,
        occurredOn: "2026-08-30",
      }),
    ]);

    expect(groups[0]?.key).toBe("2026-08-30");
    expect(formatExpenseDateGroupLabel("2026-08-30")).toBe("8 月 30 日 · 周日");
  });

  it("formats a visible date range for page-level browsing", () => {
    expect(formatExpenseDateRangeLabel("2026-08-24", "2026-08-30")).toBe("8 月 24 日—8 月 30 日");
    expect(formatExpenseDateRangeLabel("2026-08-30", "2026-08-30")).toBe("8 月 30 日 · 周日");
  });
});
