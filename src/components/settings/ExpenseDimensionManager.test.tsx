import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DataSnapshot } from "@/context/MockContext";
import { ExpenseDimensionManager, EXPENSE_DIMENSION_TABS } from "./ExpenseDimensionManager";

const snapshot = {
  expenseCategories: [{ id: "cat-food", name: "餐饮", archivedAt: null }],
  expenseTags: [{ id: "tag-work", name: "工作日", archivedAt: null }],
  paymentMethods: [{ id: "pay-wechat", name: "微信支付", archivedAt: null }],
} as unknown as DataSnapshot;

vi.mock("@/context/MockContext", () => ({
  useData: () => ({
    api: {
      createExpenseCategory: vi.fn(),
      createExpenseTag: vi.fn(),
      createPaymentMethod: vi.fn(),
    },
    data: snapshot,
    mutate: vi.fn(),
    pendingMutations: 0,
  }),
}));

describe("ExpenseDimensionManager", () => {
  it("renders the field types as sibling tabs and only one full-width panel", () => {
    const html = renderToStaticMarkup(<ExpenseDimensionManager />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("分类");
    expect(html).toContain("支付方式");
    expect(html).toContain("标签");
    expect(html).toContain("餐饮");
    expect(html).not.toContain("xl:grid-cols-3");
    expect(html).not.toContain("账目字段管理");
  });

  it("keeps the three tabs as the single source for field metadata", () => {
    expect(EXPENSE_DIMENSION_TABS.map((tab) => tab.id)).toEqual(["category", "paymentMethod", "tag"]);
    expect(EXPENSE_DIMENSION_TABS.map((tab) => tab.label)).toEqual(["分类", "支付方式", "标签"]);
  });
});
