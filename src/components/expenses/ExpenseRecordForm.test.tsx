import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Expense, ExpenseCategory, ExpenseTag, PaymentMethod } from "@/lib/domain/types";
import { ExpenseRecordForm } from "./ExpenseRecordForm";
import { seedExpenseDraft } from "./expense-utils";

const expense = (overrides: Partial<Expense> = {}): Expense =>
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
    tags: [{ id: "tag-1", name: "工作日", archivedAt: null }],
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

const categories: ExpenseCategory[] = [
  { id: "cat-food", name: "餐饮", archivedAt: null },
];

const tags: ExpenseTag[] = [
  { id: "tag-1", name: "工作日", archivedAt: null },
  { id: "tag-2", name: "校内", archivedAt: null },
];

const paymentMethods: PaymentMethod[] = [
  { id: "pay-wechat", name: "微信", archivedAt: null },
];

describe("ExpenseRecordForm", () => {
  it("renders capture facts, fallback payment text, and the inbox actions", () => {
    const html = renderToStaticMarkup(
      <ExpenseRecordForm
        expense={expense()}
        draft={seedExpenseDraft(expense())}
        categories={categories}
        tags={tags}
        paymentMethods={paymentMethods}
        timezone="Asia/Shanghai"
        mode="inbox"
        queuePosition={1}
        queueLength={3}
        pending={false}
        errorMessage={null}
        statusMessage={null}
        onDraftChange={() => undefined}
        onCopyCaptureMessage={() => undefined}
        onSelectPrevious={() => undefined}
        onSelectNext={() => undefined}
        onPrimaryAction={() => undefined}
        onSecondaryAction={() => undefined}
        onSkip={() => undefined}
      />,
    );

    expect(html).toContain("午饭");
    expect(html).toContain("未知/未填写");
    expect(html).toContain("保存修改");
    expect(html).toContain("保存并标记已整理");
    expect(html).toContain("跳过");
    expect(html).toContain("复制为备注");
  });

  it("renders the general-save mode without inbox actions", () => {
    const html = renderToStaticMarkup(
      <ExpenseRecordForm
        expense={expense({ reviewStatus: "reviewed", note: "已整理" })}
        draft={seedExpenseDraft(expense({ reviewStatus: "reviewed", note: "已整理" }))}
        categories={categories}
        tags={tags}
        paymentMethods={paymentMethods}
        timezone="Asia/Shanghai"
        mode="expenses"
        queuePosition={2}
        queueLength={4}
        pending={false}
        errorMessage={null}
        statusMessage={null}
        onDraftChange={() => undefined}
        onCopyCaptureMessage={() => undefined}
        onSelectPrevious={() => undefined}
        onSelectNext={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );

    expect(html).toContain("保存修改");
    expect(html).not.toContain("保存并标记已整理");
  });

  it("keeps the all-records detail compact until advanced information is requested", () => {
    const record = expense({ note: null });
    const html = renderToStaticMarkup(
      <ExpenseRecordForm
        expense={record}
        draft={seedExpenseDraft(record)}
        categories={categories}
        tags={tags}
        paymentMethods={paymentMethods}
        timezone="Asia/Shanghai"
        mode="expenses"
        queuePosition={1}
        queueLength={4}
        pending={false}
        errorMessage={null}
        statusMessage={null}
        onDraftChange={() => undefined}
        onCopyCaptureMessage={() => undefined}
        onSelectPrevious={() => undefined}
        onSelectNext={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );

    expect(html).toContain("更多信息");
    expect(html).toContain("添加备注...");
    expect(html).toContain('aria-label="备注"');
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("捕获留言</p>");
  });
});
