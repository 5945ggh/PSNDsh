import { describe, expect, it } from "vitest";
import { serializeExpenseCsv } from "./csv";
import type { ExpenseDataExport } from "@/lib/domain/types";

describe("expense CSV export", () => {
  it("escapes text and preserves dimension relationships", () => {
    const data = {
      schemaVersion: "1.1",
      exportedAt: "2026-08-31T00:00:00.000Z",
      effectiveTimezone: "Asia/Shanghai",
      expenses: [{
        id: "expense-1", amountCents: 123, currency: "CNY", occurredAt: null, occurredOn: "2026-08-30",
        occurredTimezone: null, occurrencePrecision: "date", recordedAt: "2026-08-31T00:00:00.000Z",
        captureMessage: "午餐,同事", note: '含"引号"', categoryId: "cat-1", paymentMethodId: "pay-1",
        tags: [{ id: "tag-1", name: "工作,日" , archivedAt: null }], reviewStatus: "reviewed", recognitionStatus: "recognized",
        recoverableCents: 0, settled: false, source: "manual", latitude: null, longitude: null, deletedAt: null,
        createdAt: "2026-08-31T00:00:00.000Z", updatedAt: "2026-08-31T00:00:00.000Z",
      }],
      expenseCategories: [{ id: "cat-1", name: "餐饮", archivedAt: null }],
      expenseTags: [{ id: "tag-1", name: "工作,日", archivedAt: null }],
      paymentMethods: [{ id: "pay-1", name: "微信", archivedAt: null }],
    } satisfies ExpenseDataExport;
    const csv = serializeExpenseCsv(data);
    expect(csv.split("\r\n")[0]).toContain("tagNames");
    expect(csv).toContain('"午餐,同事"');
    expect(csv).toContain('"含""引号"""');
    expect(csv).toContain(",餐饮,");
    expect(csv).toContain(",微信,");
  });

  it("neutralizes spreadsheet formula cells", () => {
    const data = {
      schemaVersion: "1.1",
      exportedAt: "2026-08-31T00:00:00.000Z",
      effectiveTimezone: "Asia/Shanghai",
      expenses: [{
        id: "expense-formula", amountCents: 1, currency: "CNY", occurredAt: null, occurredOn: "2026-08-30",
        occurredTimezone: null, occurrencePrecision: "date", recordedAt: "2026-08-31T00:00:00.000Z",
        captureMessage: "=HYPERLINK(\"https://example.com\")", note: "+SUM(1,1)", categoryId: null, paymentMethodId: null,
        tags: [], reviewStatus: "pending", recognitionStatus: "recognized", recoverableCents: 0, settled: false,
        source: "manual", latitude: null, longitude: null, deletedAt: null, createdAt: "2026-08-31T00:00:00.000Z", updatedAt: "2026-08-31T00:00:00.000Z",
      }],
      expenseCategories: [], expenseTags: [], paymentMethods: [],
    } satisfies ExpenseDataExport;
    const csv = serializeExpenseCsv(data);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+SUM");
  });
});
