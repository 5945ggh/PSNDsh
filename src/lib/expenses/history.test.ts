import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/domain/types";
import {
  createExpenseHistoryCursor,
  getExpenseHistoryPage,
  sortExpensesForHistory,
} from "./history";

const expense = (input: Partial<Expense> & Pick<Expense, "id">): Expense => ({
  id: input.id,
  amountCents: input.amountCents ?? 100,
  currency: "CNY",
  occurredAt: input.occurredAt ?? null,
  occurredOn: input.occurredOn ?? null,
  occurredTimezone: "Asia/Shanghai",
  occurrencePrecision: input.occurrencePrecision ?? "datetime",
  recordedAt: input.recordedAt ?? "2026-08-01T00:00:00.000Z",
  captureMessage: null,
  note: null,
  categoryId: null,
  paymentMethodId: null,
  tags: [],
  reviewStatus: "reviewed",
  recognitionStatus: "recognized",
  recoverableCents: 0,
  settled: false,
  source: "shortcut",
  latitude: null,
  longitude: null,
  deletedAt: null,
  createdAt: input.createdAt ?? input.recordedAt ?? "2026-08-01T00:00:00.000Z",
  updatedAt: input.updatedAt ?? input.createdAt ?? input.recordedAt ?? "2026-08-01T00:00:00.000Z",
});

describe("expense history pagination", () => {
  it("sorts by occurrence and uses edit time for date-only records", () => {
    const records = [
      expense({ id: "date-late", occurrencePrecision: "date", occurredOn: "2026-08-30", updatedAt: "2026-08-30T18:00:00Z" }),
      expense({ id: "date-early", occurrencePrecision: "date", occurredOn: "2026-08-30", updatedAt: "2026-08-30T09:00:00Z" }),
      expense({ id: "exact", occurredAt: "2026-08-30T12:00:00Z" }),
      expense({ id: "newer-day", occurredAt: "2026-08-31T08:00:00Z" }),
    ];

    expect(sortExpensesForHistory(records).map((item) => item.id)).toEqual([
      "newer-day",
      "exact",
      "date-late",
      "date-early",
    ]);
  });

  it("keeps exact-datetime ties stable when a record is edited", () => {
    const records = [
      expense({ id: "first", occurredAt: "2026-08-30T12:00:00Z", createdAt: "2026-08-01T00:00:00.000Z" }),
      expense({ id: "second", occurredAt: "2026-08-30T12:00:00Z", createdAt: "2026-08-02T00:00:00.000Z" }),
    ];

    const before = sortExpensesForHistory(records).map((item) => item.id);
    records[0] = expense({
      ...records[0],
      id: "first",
      occurredAt: "2026-08-30T12:00:00Z",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
    });

    expect(sortExpensesForHistory(records).map((item) => item.id)).toEqual(before);
  });

  it("loads adjacent cursor pages without duplicates or omissions", () => {
    const records = Array.from({ length: 5 }, (_, index) =>
      expense({ id: `expense-${index}`, occurredAt: `2026-08-0${5 - index}T08:00:00Z` }),
    );

    const first = getExpenseHistoryPage(records, "Asia/Shanghai", 2);
    const second = getExpenseHistoryPage(records, "Asia/Shanghai", 2, first.nextCursor ?? undefined);
    const third = getExpenseHistoryPage(records, "Asia/Shanghai", 2, second.nextCursor ?? undefined);

    expect(first.items.map((item) => item.id)).toEqual(["expense-0", "expense-1"]);
    expect(second.items.map((item) => item.id)).toEqual(["expense-2", "expense-3"]);
    expect(third.items.map((item) => item.id)).toEqual(["expense-4"]);
    expect(first.hasMore).toBe(true);
    expect(second.hasMore).toBe(true);
    expect(third).toMatchObject({ hasMore: false, nextCursor: null });
  });

  it("does not expose a cursor when the first page contains everything", () => {
    const records = [expense({ id: "only" })];
    const page = getExpenseHistoryPage(records, "Asia/Shanghai", 25);

    expect(page).toEqual({ items: records, nextCursor: null, hasMore: false });
    expect(createExpenseHistoryCursor(records[0]!)).toEqual(expect.any(String));
  });

  it("rejects a malformed cursor instead of silently returning an empty page", () => {
    expect(() => getExpenseHistoryPage([expense({ id: "only" })], "Asia/Shanghai", 25, "not-a-cursor"))
      .toThrow("REQUEST_INVALID");
  });
});
