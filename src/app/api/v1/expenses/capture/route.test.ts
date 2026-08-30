import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const expenseId = "018f690d-56b5-7d60-8da8-59df15d4ac80";
let databasePath = "";

const post = async (authorization: string | null, body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/v1/expenses/capture", {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}), ...headers },
    body: JSON.stringify(body),
  }));
};

describe("POST /api/v1/expenses/capture", () => {
  beforeEach(() => {
    vi.resetModules();
    databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pd-expense-api-")), "dashboard.db");
    vi.stubEnv("DATABASE_URL", `file:${databasePath}`);
    vi.stubEnv("AUTH_SECRET", "route-test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  const setup = async () => {
    const { getRuntimeDatabase } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { SqliteApplicationService } = await import("@/lib/persistence/sqlite-service");
    const db = getRuntimeDatabase();
    const now = "2026-08-28T00:00:00.000Z";
    db.insert(users).values([
      { id: "user-a", username: "a", passwordHash: null, nickname: null, profileEmail: null, createdAt: now, updatedAt: now },
      { id: "user-b", username: "b", passwordHash: null, nickname: null, profileEmail: null, createdAt: now, updatedAt: now },
    ]).run();
    const first = new SqliteApplicationService(db, { userId: "user-a" }).createApiKey("Shortcut");
    const second = new SqliteApplicationService(db, { userId: "user-b" }).createApiKey("Other shortcut");
    return { db, first, second, appA: new SqliteApplicationService(db, { userId: "user-a" }) };
  };

  it("captures a minimal CNY expense and makes identical UUID retries idempotent", async () => {
    const { first, db } = await setup();
    const body = { id: expenseId, amount_cents: 1250 };
    const created = await post(`Bearer ${first.apiKey}`, body);
    const retried = await post(`Bearer ${first.apiKey}`, body);

    expect(created.status).toBe(201);
    expect(retried.status).toBe(200);
    const initial = await created.json();
    const repeated = await retried.json();
    expect(initial.data).toMatchObject({ id: expenseId, amountCents: 1250, currency: "CNY", paymentMethodId: null, source: "shortcut" });
    expect(repeated.data).toEqual(initial.data);
    const { apiKeys } = await import("@/lib/db/schema");
    expect(db.select().from(apiKeys).where(eq(apiKeys.id, first.id)).get()?.lastUsedAt).toEqual(expect.any(String));
  });

  it("generates an id when the shortcut omits or leaves the UUID blank", async () => {
    const { first } = await setup();

    const omitted = await post(`Bearer ${first.apiKey}`, { amount_cents: 500, capture_message: "省略 UUID" });
    const blank = await post(`Bearer ${first.apiKey}`, { id: "", amount_cents: 600, capture_message: "空白 UUID" });

    expect(omitted.status).toBe(201);
    expect(blank.status).toBe(201);
    const omittedBody = await omitted.json();
    const blankBody = await blank.json();
    expect(omittedBody.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(blankBody.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(blankBody.data.id).not.toBe(omittedBody.data.id);
  });

  it("accepts a floating-point tail from shortcut arithmetic but rejects real fractional cents", async () => {
    const { first } = await setup();

    const floatingTail = await post(`Bearer ${first.apiKey}`, { amount_cents: 1250.0000000000002 });
    const fractionalCent = await post(`Bearer ${first.apiKey}`, { amount_cents: 1250.25 });

    expect(floatingTail.status).toBe(201);
    await expect(floatingTail.json()).resolves.toMatchObject({ data: { amountCents: 1250 } });
    expect(fractionalCent.status).toBe(400);
  });

  it("rejects invalid and revoked keys without exposing key material", async () => {
    const { first, appA } = await setup();
    const invalid = await post("Bearer pdak_aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", { id: expenseId, amount_cents: 1250 });
    appA.revokeApiKey(first.id);
    const revoked = await post(`Bearer ${first.apiKey}`, { id: expenseId, amount_cents: 1250 });

    expect(invalid.status).toBe(401);
    expect(revoked.status).toBe(401);
    expect(await revoked.text()).not.toContain(first.apiKey);
  });

  it("rejects conflicting retries, soft-deleted UUIDs, and non-CNY currency", async () => {
    const { first, appA } = await setup();
    const auth = `Bearer ${first.apiKey}`;
    await post(auth, { id: expenseId, amount_cents: 1250 });
    const conflict = await post(auth, { id: expenseId, amount_cents: 1251 });
    appA.deleteExpense(expenseId);
    const deleted = await post(auth, { id: expenseId, amount_cents: 1250 });
    const otherCurrency = await post(auth, { id: "018f690d-56b5-7d60-8da8-59df15d4ac81", amount_cents: 1250, currency: "USD" });

    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ error: { code: "EXPENSE_IDEMPOTENCY_CONFLICT" } });
    expect(deleted.status).toBe(409);
    expect(otherCurrency.status).toBe(400);
  });

  it("keeps users isolated and ignores self-reported user identity", async () => {
    const { first, second } = await setup();
    const firstResponse = await post(`Bearer ${first.apiKey}`, { id: expenseId, amount_cents: 1250 }, { "x-user-id": "user-b" });
    const secondResponse = await post(`Bearer ${second.apiKey}`, { id: expenseId, amount_cents: 550 });
    const forgedBody = await post(`Bearer ${first.apiKey}`, { id: "018f690d-56b5-7d60-8da8-59df15d4ac82", amount_cents: 1250, username: "b" });
    const { GET } = await import("@/app/api/v1/entries/route");
    const protectedResponse = GET(new Request("http://localhost/api/v1/entries", { headers: { authorization: `Bearer ${first.apiKey}`, "x-user-id": "user-b" } }));

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(forgedBody.status).toBe(400);
    expect(protectedResponse.status).toBe(401);
  });
});
