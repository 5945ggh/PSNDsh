import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/domain/types";
import { ExpenseRecordList, previewExpenseTags } from "./ExpenseRecordList";

const expense = (tagCount: number): Expense =>
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
    tags: Array.from({ length: tagCount }, (_, index) => ({
      id: `tag-${index + 1}`,
      name: `标签${index + 1}`,
      archivedAt: null,
    })),
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
  }) satisfies Expense;

const expenses = [
  {
    id: "expense-1",
    amountCents: 800,
    currency: "CNY",
    occurredAt: "2026-08-30T09:30:00+08:00",
    occurredOn: null,
    occurredTimezone: "Asia/Shanghai",
    occurrencePrecision: "datetime",
    recordedAt: "2026-08-30T09:35:00+08:00",
    captureMessage: "晚饭",
    note: null,
    categoryId: null,
    paymentMethodId: null,
    tags: [{ id: "tag-1", name: "晚间", archivedAt: null }],
    reviewStatus: "pending",
    recognitionStatus: "recognized",
    recoverableCents: 0,
    settled: false,
    source: "shortcut",
    latitude: null,
    longitude: null,
    deletedAt: null,
    createdAt: "2026-08-30T23:35:00.000Z",
    updatedAt: "2026-08-30T23:35:00.000Z",
  },
  {
    id: "expense-2",
    amountCents: 560,
    currency: "CNY",
    occurredAt: "2026-08-29T10:30:00+08:00",
    occurredOn: null,
    occurredTimezone: "Asia/Shanghai",
    occurrencePrecision: "datetime",
    recordedAt: "2026-08-29T10:35:00+08:00",
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
    createdAt: "2026-08-29T10:35:00.000Z",
    updatedAt: "2026-08-29T10:35:00.000Z",
  },
] satisfies Expense[];

describe("previewExpenseTags", () => {
  it("limits visible tags and reports remaining hidden count", () => {
    const preview = previewExpenseTags(expense(5), 3);

    expect(preview.visibleTags).toHaveLength(3);
    expect(preview.hiddenCount).toBe(2);
    expect(preview.visibleTags.map((tag) => tag.name)).toEqual(["标签1", "标签2", "标签3"]);
  });

  it("returns no hidden count when the tag list fits", () => {
    const preview = previewExpenseTags(expense(2), 3);

    expect(preview.visibleTags).toHaveLength(2);
    expect(preview.hiddenCount).toBe(0);
  });
});

describe("ExpenseRecordList", () => {
  it("renders grouped date headers and a date-range page label", () => {
    const html = renderToStaticMarkup(
      <ExpenseRecordList
        dataTestId="expense-record-list"
        title="全部记录"
        expenses={expenses}
        selectedId={null}
        timezone="Asia/Shanghai"
        emptyLabel="无记录"
        onSelect={() => undefined}
        totalCount={42}
        pageIndex={0}
        pageCount={2}
        onPageChange={() => undefined}
        categoryNames={new Map()}
        paymentMethodNames={new Map()}
        groupByDate
        summaryExpenses={expenses}
      />,
    );

    expect(html).toContain("8 月 30 日 · 周日");
    expect(html).toContain("8 月 29 日 · 周六");
    expect(html).toContain("8 月 29 日—8 月 30 日");
    expect(html).toContain("第 1 / 2 页 · 共 42 条");
  });

  it("uses a continuous loading footer instead of page navigation for history", () => {
    const html = renderToStaticMarkup(
      <ExpenseRecordList
        dataTestId="expense-record-list"
        title="全部记录"
        expenses={expenses}
        selectedId={null}
        timezone="Asia/Shanghai"
        emptyLabel="无记录"
        onSelect={() => undefined}
        totalCount={42}
        hasMore
        onLoadMore={() => undefined}
        categoryNames={new Map()}
        paymentMethodNames={new Map()}
        groupByDate
        summaryExpenses={expenses}
      />,
    );

    expect(html).toContain("加载更多");
    expect(html).not.toContain("上一页");
    expect(html).not.toContain("下一页");
    expect(html).not.toContain("第 1 / 2 页");
  });
});
