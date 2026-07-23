import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@/lib/application/error";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSessionToken,
  jsonError,
  noContent,
  sessionUserIdForRequest,
  setSessionCookie,
} from "./http";
import { NextResponse } from "next/server";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HTTP session boundary", () => {
  it("accepts a current signed session cookie but never an x-user-id header", () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const now = Date.UTC(2026, 6, 22);
    const token = createSessionToken("user-a", now);

    expect(sessionUserIdForRequest(new Request("http://localhost/api/v1/me", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }), now)).toBe("user-a");
    expect(sessionUserIdForRequest(new Request("http://localhost/api/v1/me", {
      headers: { "x-user-id": "user-a" },
    }), now)).toBeNull();
  });

  it("rejects a tampered or expired session token", () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const now = Date.UTC(2026, 6, 22);
    const token = createSessionToken("user-a", now);
    const [payload, signature] = token.split(".");
    const tampered = `${payload}.${signature!.slice(0, -1)}x`;

    expect(sessionUserIdForRequest(new Request("http://localhost", {
      headers: { cookie: `${SESSION_COOKIE}=${tampered}` },
    }), now)).toBeNull();
    expect(sessionUserIdForRequest(new Request("http://localhost", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }), now + 31 * 24 * 60 * 60 * 1_000)).toBeNull();
  });

  it("requires AUTH_SECRET in production and applies the required cookie flags", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createSessionToken("user-a")).toThrow(/AUTH_SECRET/);

    vi.stubEnv("AUTH_SECRET", "test-secret");
    const response = setSessionCookie(NextResponse.json({ data: {} }), "user-a");
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("set-cookie")).toContain("Secure");

    const cleared = clearSessionCookie(NextResponse.json({ data: null }));
    expect(cleared.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("uses stable response envelopes and leaves 204 responses body-free", async () => {
    const unauthorized = jsonError(new ApplicationError("UNAUTHORIZED", "当前没有登录用户"));
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "当前没有登录用户", details: {} },
    });

    const response = noContent();
    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });
});
