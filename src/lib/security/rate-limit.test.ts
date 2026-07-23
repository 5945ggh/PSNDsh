import { describe, expect, it } from "vitest";
import { ApplicationError } from "@/lib/application/error";
import { assertRateLimit, FixedWindowRateLimiter } from "./rate-limit";

describe("authentication rate limiting", () => {
  it("limits attempts within a window and permits them after expiry", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter({ maxAttempts: 2, windowMs: 10_000, clock: () => now });

    expect(limiter.allow("client:user").allowed).toBe(true);
    expect(limiter.allow("client:user").allowed).toBe(true);
    expect(limiter.allow("client:user")).toMatchObject({ allowed: false, retryAfterSeconds: 10 });

    now += 10_000;
    expect(limiter.allow("client:user").allowed).toBe(true);
  });

  it("keeps different keys independent and exposes a typed application error", () => {
    const limiter = new FixedWindowRateLimiter({ maxAttempts: 1, windowMs: 10_000, clock: () => 1_000 });
    limiter.allow("client:a");
    expect(limiter.allow("client:b").allowed).toBe(true);

    expect(() => assertRateLimit(limiter.allow("client:a"))).toThrow(ApplicationError);
    try {
      assertRateLimit(limiter.allow("client:a"));
    } catch (error) {
      expect(error).toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSeconds: 10 } });
    }
  });
});
