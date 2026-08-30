import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let databasePath = "";

describe("expense category routes", () => {
  beforeEach(() => {
    vi.resetModules();
    databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pd-expense-category-")), "dashboard.db");
    vi.stubEnv("DATABASE_URL", `file:${databasePath}`);
    vi.stubEnv("AUTH_SECRET", "expense-category-route-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  it("renames, archives, restores, merges, and includes archived categories through the HTTP contract", async () => {
    const { getRuntimeDatabase } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { createSessionToken, SESSION_COOKIE, SAME_ORIGIN_HEADER } = await import("@/lib/api/http");
    const { SqliteApplicationService } = await import("@/lib/persistence/sqlite-service");
    const { GET } = await import("./route");
    const detail = await import("./[id]/route");
    const restore = await import("./[id]/restore/route");
    const merge = await import("./[id]/merge/route");
    const now = "2026-08-28T00:00:00.000Z";
    const db = getRuntimeDatabase();
    db.insert(users).values({ id: "user-a", username: "user-a", passwordHash: null, nickname: null, profileEmail: null, createdAt: now, updatedAt: now }).run();
    const cookie = `${SESSION_COOKIE}=${createSessionToken("user-a")}`;
    const service = new SqliteApplicationService(db, { userId: "user-a" });

    const source = service.createExpenseCategory({ name: "早餐" });
    const target = service.createExpenseCategory({ name: "餐饮" });
    const expense = service.captureExpense({ id: "expense-category-route", amountCents: 1_000 }).expense;
    service.updateExpense(expense.id, { categoryId: source.id, reviewStatus: "reviewed" });

    const renamed = await detail.PATCH(new Request(`http://localhost/api/v1/expenses/categories/${source.id}`, {
      method: "PATCH",
      headers: { cookie, [SAME_ORIGIN_HEADER]: "1", "content-type": "application/json" },
      body: JSON.stringify({ name: "早饭" }),
    }), { params: Promise.resolve({ id: source.id }) });
    const archived = await detail.DELETE(new Request(`http://localhost/api/v1/expenses/categories/${source.id}`, {
      method: "DELETE",
      headers: { cookie, [SAME_ORIGIN_HEADER]: "1" },
    }), { params: Promise.resolve({ id: source.id }) });
    const restored = await restore.POST(new Request(`http://localhost/api/v1/expenses/categories/${source.id}/restore`, {
      method: "POST",
      headers: { cookie, [SAME_ORIGIN_HEADER]: "1", "content-type": "application/json" },
      body: "{}",
    }), { params: Promise.resolve({ id: source.id }) });
    const merged = await merge.POST(new Request(`http://localhost/api/v1/expenses/categories/${source.id}/merge`, {
      method: "POST",
      headers: { cookie, [SAME_ORIGIN_HEADER]: "1", "content-type": "application/json" },
      body: JSON.stringify({ targetId: target.id }),
    }), { params: Promise.resolve({ id: source.id }) });
    const listed = await GET(new Request("http://localhost/api/v1/expenses/categories?includeArchived=1", { headers: { cookie } }));

    expect(renamed.status).toBe(200);
    expect(archived.status).toBe(200);
    expect(restored.status).toBe(200);
    expect(merged.status).toBe(200);
    expect((await listed.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: source.id, name: "早饭", archivedAt: expect.any(String) }),
      expect.objectContaining({ id: target.id, name: "餐饮", archivedAt: null }),
    ]));
    expect(service.getExpenseById(expense.id)).toMatchObject({ categoryId: target.id });
  });
});
