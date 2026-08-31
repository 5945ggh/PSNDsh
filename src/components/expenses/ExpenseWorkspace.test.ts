import { describe, expect, it } from "vitest";
import type { DataSnapshot } from "@/context/MockContext";
import type { Expense } from "@/lib/domain/types";
import {
  EXPENSE_PAGE_SIZE,
  getExpenseDateRangeForPreset,
  getExpensePageCount,
  getExpensePageIndex,
  getExpensePageSlice,
  getExpenseKeyboardDirection,
  getExpenseWorkspaceInitialSelection,
  inferExpenseDatePreset,
  updateSnapshotWithExpense,
} from "./ExpenseWorkspace";

const expense = (id: string, reviewStatus: Expense["reviewStatus"]): Expense => ({
  id,
  amountCents: 100,
  currency: "CNY",
  occurredAt: "2026-08-29T00:00:00.000Z",
  occurredOn: null,
  occurredTimezone: "Asia/Shanghai",
  occurrencePrecision: "datetime",
  recordedAt: "2026-08-29T00:00:00.000Z",
  captureMessage: id,
  note: null,
  categoryId: null,
  paymentMethodId: null,
  tags: [],
  reviewStatus,
  recognitionStatus: "recognized",
  recoverableCents: 0,
  settled: false,
  source: "shortcut",
  latitude: null,
  longitude: null,
  deletedAt: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
});

describe("updateSnapshotWithExpense", () => {
  it("removes reviewed records from Inbox while retaining the updated history row", () => {
    const current = expense("current", "pending");
    const next = expense("next", "pending");
    const snapshot = {
      capabilities: null,
      session: { user: null },
      entries: [],
      currentWeekPlan: null,
      activeFocus: null,
      focusSessions: [],
      scheduleBlocks: [],
      dashboard: null,
      statistics: {},
      expenses: [current, next],
      expensesNextCursor: null,
      expensesHasMore: false,
      inboxExpenses: [current, next],
      expenseCategories: [],
      expenseTags: [],
      paymentMethods: [],
    } satisfies DataSnapshot;

    const reviewed = { ...current, reviewStatus: "reviewed" as const, note: "整理后" };
    const updated = updateSnapshotWithExpense(snapshot, reviewed);

    expect(updated.inboxExpenses).toEqual([next]);
    expect(updated.expenses[0]).toEqual(reviewed);
  });
});

describe("expense workspace paging", () => {
  it("maps desktop arrow keys to previous and next records", () => {
    expect(getExpenseKeyboardDirection("ArrowLeft")).toBe(-1);
    expect(getExpenseKeyboardDirection("ArrowRight")).toBe(1);
    expect(getExpenseKeyboardDirection("ArrowUp")).toBe(0);
    expect(getExpenseKeyboardDirection("ArrowDown")).toBe(0);
    expect(getExpenseKeyboardDirection("Enter")).toBe(0);
  });

  it("starts expenses mode with no selection and inbox mode with the first record", () => {
    const first = expense("first", "pending");
    const second = expense("second", "pending");

    expect(getExpenseWorkspaceInitialSelection("expenses", [first, second])).toBeNull();
    expect(getExpenseWorkspaceInitialSelection("inbox", [first, second])).toBe("first");
  });

  it("slices records into stable pages of 25 items", () => {
    const records = Array.from({ length: EXPENSE_PAGE_SIZE + 1 }, (_, index) =>
      expense(`expense-${index + 1}`, "pending"),
    );

    expect(getExpensePageCount(records.length)).toBe(2);
    expect(getExpensePageIndex(0)).toBe(0);
    expect(getExpensePageIndex(EXPENSE_PAGE_SIZE)).toBe(1);
    expect(getExpensePageSlice(records, 0)).toHaveLength(EXPENSE_PAGE_SIZE);
    expect(getExpensePageSlice(records, 1)).toHaveLength(1);
    expect(getExpensePageSlice(records, 1)[0]?.id).toBe(`expense-${EXPENSE_PAGE_SIZE + 1}`);
  });
});

describe("expense workspace mobile date presets", () => {
  it("uses the configured application timezone rather than the browser local date", () => {
    const now = new Date("2026-08-31T00:30:00.000Z");

    expect(getExpenseDateRangeForPreset("today", "America/Los_Angeles", now)).toEqual({
      from: "2026-08-30",
      to: "2026-08-30",
    });
    expect(getExpenseDateRangeForPreset("last7", "America/Los_Angeles", now)).toEqual({
      from: "2026-08-24",
      to: "2026-08-30",
    });
  });

  it("uses the timezone-local month and recognizes matching preset ranges", () => {
    const now = new Date("2026-09-01T00:30:00.000Z");
    const range = getExpenseDateRangeForPreset("month", "America/Los_Angeles", now);

    expect(range).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(inferExpenseDatePreset(range.from, range.to, "America/Los_Angeles", now)).toBe("month");
    expect(inferExpenseDatePreset(range.from, range.to, "Asia/Shanghai", now)).toBe("custom");
  });
});
