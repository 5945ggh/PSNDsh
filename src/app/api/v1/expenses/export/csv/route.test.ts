import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let databasePath = "";

describe("expense CSV export route", () => {
  beforeEach(() => {
    vi.resetModules();
    databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pd-expense-csv-")), "dashboard.db");
    vi.stubEnv("DATABASE_URL", `file:${databasePath}`);
    vi.stubEnv("AUTH_SECRET", "expense-csv-route-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  it("returns a downloadable UTF-8 CSV for the current account", async () => {
    const { getRuntimeDatabase } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { createSessionToken, SESSION_COOKIE } = await import("@/lib/api/http");
    const { SqliteApplicationService } = await import("@/lib/persistence/sqlite-service");
    const { GET } = await import("./route");
    const now = "2026-08-31T00:00:00.000Z";
    const db = getRuntimeDatabase();
    db.insert(users).values({ id: "user-a", username: "user-a", passwordHash: null, nickname: null, profileEmail: null, createdAt: now, updatedAt: now }).run();
    const service = new SqliteApplicationService(db, { userId: "user-a", clock: () => new Date(now) });
    service.captureExpense({ id: "csv-expense", amountCents: 1200, captureMessage: "午餐,同事" });
    const response = await GET(new Request("http://localhost/api/v1/expenses/export/csv", { headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("user-a")}` } }));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const body = new TextDecoder().decode(bytes);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(".csv");
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(body.startsWith("id,amountCents")).toBe(true);
    expect(body).toContain('"午餐,同事"');
  });
});
