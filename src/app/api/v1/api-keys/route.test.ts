import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let databasePath = "";

describe("API key settings routes", () => {
  beforeEach(() => {
    vi.resetModules();
    databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pd-api-key-settings-")), "dashboard.db");
    vi.stubEnv("DATABASE_URL", `file:${databasePath}`);
    vi.stubEnv("AUTH_SECRET", "settings-route-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
  });

  it("requires the web session to create, list, reveal, and revoke keys", async () => {
    const { getRuntimeDatabase } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { createSessionToken, SESSION_COOKIE, SAME_ORIGIN_HEADER } = await import("@/lib/api/http");
    const { POST, GET } = await import("./route");
    const detail = await import("./[id]/route");
    const now = "2026-08-28T00:00:00.000Z";
    getRuntimeDatabase().insert(users).values({ id: "user-a", username: "user-a", passwordHash: null, nickname: null, profileEmail: null, createdAt: now, updatedAt: now }).run();
    const cookie = `${SESSION_COOKIE}=${createSessionToken("user-a")}`;

    const anonymous = await POST(new Request("http://localhost/api/v1/api-keys", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify({ name: "shortcut" }) }));
    const created = await POST(new Request("http://localhost/api/v1/api-keys", { method: "POST", headers: { cookie, [SAME_ORIGIN_HEADER]: "1", "content-type": "application/json" }, body: JSON.stringify({ name: "shortcut" }) }));
    const payload = await created.json();
    const id = payload.data.id as string;
    const key = payload.data.apiKey as string;
    const listed = GET(new Request("http://localhost/api/v1/api-keys", { headers: { cookie } }));
    const revealed = await detail.GET(new Request(`http://localhost/api/v1/api-keys/${id}`, { headers: { cookie } }), { params: Promise.resolve({ id }) });
    const anonymousReveal = await detail.GET(new Request(`http://localhost/api/v1/api-keys/${id}`), { params: Promise.resolve({ id }) });
    const revoked = await detail.DELETE(new Request(`http://localhost/api/v1/api-keys/${id}`, { method: "DELETE", headers: { cookie, [SAME_ORIGIN_HEADER]: "1" } }), { params: Promise.resolve({ id }) });
    const recreated = await POST(new Request("http://localhost/api/v1/api-keys", { method: "POST", headers: { cookie, [SAME_ORIGIN_HEADER]: "1", "content-type": "application/json" }, body: JSON.stringify({ name: "replacement" }) }));

    expect(anonymous.status).toBe(401);
    expect(created.status).toBe(201);
    expect((await listed.json()).data).toEqual([expect.objectContaining({ id, name: "shortcut", revokedAt: null })]);
    expect((await revealed.json()).data).toEqual({ id, apiKey: key });
    expect(anonymousReveal.status).toBe(401);
    expect(revoked.status).toBe(204);
    expect(recreated.status).toBe(201);
  });
});
