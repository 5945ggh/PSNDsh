import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let databasePath = "";

describe("expense detail routes", () => {
  beforeEach(() => {
    vi.resetModules();
    databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pd-expense-detail-")), "dashboard.db");
    vi.stubEnv("DATABASE_URL", `file:${databasePath}`);
    vi.stubEnv("AUTH_SECRET", "expense-detail-route-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  it("soft-deletes an expense through the authenticated DELETE contract", async () => {
    const { getRuntimeDatabase } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { createSessionToken, SESSION_COOKIE, SAME_ORIGIN_HEADER } = await import("@/lib/api/http");
    const { SqliteApplicationService } = await import("@/lib/persistence/sqlite-service");
    const detail = await import("./route");
    const now = "2026-08-28T00:00:00.000Z";
    const db = getRuntimeDatabase();
    db.insert(users).values({ id: "user-a", username: "user-a", passwordHash: null, nickname: null, profileEmail: null, createdAt: now, updatedAt: now }).run();
    const cookie = `${SESSION_COOKIE}=${createSessionToken("user-a")}`;
    const service = new SqliteApplicationService(db, { userId: "user-a" });
    const expense = service.captureExpense({ id: "expense-delete-route", amountCents: 1_000 }).expense;

    const anonymous = await detail.DELETE(new Request(`http://localhost/api/v1/expenses/${expense.id}`, { method: "DELETE", headers: { [SAME_ORIGIN_HEADER]: "1" } }), { params: Promise.resolve({ id: expense.id }) });
    const deleted = await detail.DELETE(new Request(`http://localhost/api/v1/expenses/${expense.id}`, { method: "DELETE", headers: { cookie, [SAME_ORIGIN_HEADER]: "1" } }), { params: Promise.resolve({ id: expense.id }) });
    const missing = await detail.GET(new Request(`http://localhost/api/v1/expenses/${expense.id}`, { headers: { cookie } }), { params: Promise.resolve({ id: expense.id }) });

    expect(anonymous.status).toBe(401);
    expect(deleted.status).toBe(204);
    expect(missing.status).toBe(404);
    expect(service.getExpenseById(expense.id, { includeDeleted: true })).toMatchObject({ id: expense.id });
  });
});
