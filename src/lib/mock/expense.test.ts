import { describe, expect, it } from "vitest";
import { MockApplicationService } from "./service";
import { MockDataStore } from "./store";

describe("mock expense inbox contract", () => {
  it("captures pending inbox expenses and keeps capture messages when organizing them", () => {
    const app = new MockApplicationService(new MockDataStore());
    const category = app.createExpenseCategory({ name: "餐饮" });
    const tagSchool = app.createExpenseTag({ name: "校园" });
    const tagTravel = app.createExpenseTag({ name: "出行" });
    const paymentMethod = app.createPaymentMethod({ name: "微信" });

    const captured = app.captureExpense({
      id: "expense-new",
      amountCents: 1_250,
      captureMessage: "午饭",
    }).expense;

    expect(captured.reviewStatus).toBe("pending");
    expect(app.getInboxExpenses().map((expense) => expense.id)).toContain("expense-new");

    const organized = app.updateExpense(captured.id, {
      amountCents: 1_360,
      occurredOn: "2026-06-26",
      occurrencePrecision: "date",
      note: "午饭",
      categoryId: category.id,
      paymentMethodId: paymentMethod.id,
      tagIds: [tagSchool.id, tagSchool.id, tagTravel.id],
      reviewStatus: "reviewed",
    });

    expect(organized).toMatchObject({
      amountCents: 1_360,
      occurredOn: "2026-06-26",
      occurrencePrecision: "date",
      note: "午饭",
      categoryId: category.id,
      paymentMethodId: paymentMethod.id,
      captureMessage: "午饭",
      reviewStatus: "reviewed",
      tags: [
        { id: tagSchool.id, name: "校园" },
        { id: tagTravel.id, name: "出行" },
      ],
    });
    expect(app.getInboxExpenses().map((expense) => expense.id)).not.toContain("expense-new");
    expect(app.getExpenses().map((expense) => expense.id)).toContain("expense-new");
  });

  it("keeps reviewed unclassified expenses in the full list while inbox remains pending-only", () => {
    const app = new MockApplicationService(new MockDataStore());

    expect(app.getExpenses().some((expense) => expense.reviewStatus === "reviewed" && expense.categoryId === null)).toBe(true);
    expect(app.getInboxExpenses().every((expense) => expense.reviewStatus === "pending")).toBe(true);
  });

  it("permits empty payment methods during review updates", () => {
    const app = new MockApplicationService(new MockDataStore());
    const expense = app.captureExpense({ id: "expense-empty-payment", amountCents: 900 }).expense;

    const updated = app.updateExpense(expense.id, {
      paymentMethodId: null,
      reviewStatus: "reviewed",
    });

    expect(updated.paymentMethodId).toBeNull();
    expect(updated.reviewStatus).toBe("reviewed");
  });

  it("archives, restores, and merges expense dimensions without losing historical references", () => {
    const app = new MockApplicationService(new MockDataStore());
    const category = app.createExpenseCategory({ name: "早餐" });
    const mergedTarget = app.createExpenseCategory({ name: "餐饮" });
    const tag = app.createExpenseTag({ name: "出行" });
    const tagTarget = app.createExpenseTag({ name: "旅行" });
    const paymentMethod = app.createPaymentMethod({ name: "现金" });
    const paymentTarget = app.createPaymentMethod({ name: "支付宝" });
    const expense = app.captureExpense({ id: "expense-dimension-ops", amountCents: 1_500 }).expense;

    const renamed = app.renameExpenseCategory(category.id, { name: "早饭" });
    expect(renamed.name).toBe("早饭");

    const archived = app.archiveExpenseCategory(renamed.id);
    expect(archived.archivedAt).toEqual(expect.any(String));
    const restored = app.restoreExpenseCategory(renamed.id);
    expect(restored.archivedAt).toBeNull();

    const mergedCategory = app.mergeExpenseCategory(renamed.id, { targetId: mergedTarget.id });
    expect(mergedCategory.archivedAt).toEqual(expect.any(String));
    expect(app.getExpenseCategories(true).map((item) => item.id)).toContain(mergedCategory.id);

    app.updateExpense(expense.id, {
      categoryId: mergedTarget.id,
      tagIds: [tag.id],
      paymentMethodId: paymentMethod.id,
    });
    app.mergeExpenseTag(tag.id, { targetId: tagTarget.id });
    app.mergePaymentMethod(paymentMethod.id, { targetId: paymentTarget.id });

    const organized = app.getExpenseById(expense.id);
    expect(organized).toMatchObject({
      categoryId: mergedTarget.id,
      paymentMethodId: paymentTarget.id,
      tags: [{ id: tagTarget.id, name: "旅行" }],
    });
    expect(() => app.createExpenseCategory({ name: "餐饮" })).toThrow(/EXPENSE_DIMENSION_NAME_TAKEN/);
    expect(app.restoreExpenseCategory(mergedCategory.id)).toMatchObject({ id: mergedCategory.id, archivedAt: null });
  });
});
