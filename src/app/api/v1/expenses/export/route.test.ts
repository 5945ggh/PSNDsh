import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let databasePath = "";

describe("expense JSON export route", () => {
  beforeEach(() => {
    vi.resetModules();
    databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pd-expense-json-")), "dashboard.db");
    vi.stubEnv("DATABASE_URL", `file:${databasePath}`);
    vi.stubEnv("AUTH_SECRET", "expense-json-route-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  it("returns a downloadable JSON export without allowing caching", async () => {
    const { getRuntimeDatabase } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { createSessionToken, SESSION_COOKIE } = await import("@/lib/api/http");
    const { SqliteApplicationService } = await import("@/lib/persistence/sqlite-service");
    const { GET } = await import("./route");
    const now = "2026-08-31T00:00:00.000Z";
    const db = getRuntimeDatabase();
    db.insert(users).values({ id: "user-a", username: "user-a", passwordHash: null, nickname: null, profileEmail: null, createdAt: now, updatedAt: now }).run();
    const service = new SqliteApplicationService(db, { userId: "user-a", clock: () => new Date(now) });
    service.captureExpense({ id: "json-expense", amountCents: 1200, captureMessage: "午餐" });

    const response = await GET(new Request("http://localhost/api/v1/expenses/export", {
      headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("user-a")}` },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toContain(".json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.data.expenses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "json-expense", amountCents: 1200 }),
    ]));
  });
});
