import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistentApiAdapter } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PersistentApiAdapter expense capture", () => {
  it("sends only the minimal capture body without a payment method field", async () => {
    const responsePayload = {
      data: {
        id: "expense-capture-test",
        amountCents: 1_250,
        currency: "CNY",
        occurredAt: "2026-06-26T12:00:00.000Z",
        occurredOn: null,
        occurredTimezone: "Asia/Shanghai",
        occurrencePrecision: "datetime" as const,
        recordedAt: "2026-06-26T12:00:00.000Z",
        captureMessage: "午饭",
        note: null,
        categoryId: null,
        paymentMethodId: null,
        tags: [],
        reviewStatus: "pending" as const,
        recognitionStatus: "recognized" as const,
        recoverableCents: 0,
        settled: false,
        source: "shortcut" as const,
        latitude: null,
        longitude: null,
        deletedAt: null,
        createdAt: "2026-06-26T12:00:00.000Z",
        updatedAt: "2026-06-26T12:00:00.000Z",
      },
    };

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(responsePayload), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = new PersistentApiAdapter();
    await api.captureExpense({
      id: "expense-capture-test",
      amountCents: 1_250,
      captureMessage: "午饭",
    }, "api-key-secret");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/v1/expenses/capture");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer api-key-secret");
    expect(JSON.parse(String(init.body))).toEqual({
      id: "expense-capture-test",
      amount_cents: 1_250,
      capture_message: "午饭",
    });
    expect(String(init.body)).not.toContain("payment_method");
  });
});
