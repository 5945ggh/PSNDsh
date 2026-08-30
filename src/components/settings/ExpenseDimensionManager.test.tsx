import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DataSnapshot } from "@/context/MockContext";
import {
  addCategory,
  addPaymentMethod,
  addTag,
  ExpenseDimensionManager,
  EXPENSE_DIMENSION_TABS,
} from "./ExpenseDimensionManager";

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

  it("upserts a created dimension when a background refresh reapplies the same result", () => {
    const category = { id: "cat-new", name: "早餐", archivedAt: null };
    const tag = { id: "tag-new", name: "报销", archivedAt: null };
    const paymentMethod = { id: "pay-new", name: "现金", archivedAt: null };

    const snapshotWithDuplicate = addCategory(addCategory(snapshot, category), category);
    const afterCategory = addCategory(snapshotWithDuplicate, category);
    const afterTag = addTag(addTag(snapshot, tag), tag);
    const afterPaymentMethod = addPaymentMethod(addPaymentMethod(snapshot, paymentMethod), paymentMethod);

    expect(afterCategory.expenseCategories.filter((item) => item.id === category.id)).toHaveLength(1);
    expect(afterTag.expenseTags.filter((item) => item.id === tag.id)).toHaveLength(1);
    expect(afterPaymentMethod.paymentMethods.filter((item) => item.id === paymentMethod.id)).toHaveLength(1);
    expect(afterCategory.expenseTags).toBe(snapshot.expenseTags);
    expect(afterCategory.paymentMethods).toBe(snapshot.paymentMethods);
    expect(afterTag.expenseCategories).toBe(snapshot.expenseCategories);
    expect(afterPaymentMethod.expenseTags).toBe(snapshot.expenseTags);
  });
});
