import { ApplicationError } from "@/lib/application/error";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimiterOptions = {
  maxAttempts: number;
  windowMs: number;
  clock?: () => number;
};

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly clock: () => number;

  constructor(private readonly options: RateLimiterOptions) {
    this.clock = options.clock ?? Date.now;
  }

  allow(key: string) {
    const now = this.clock();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= this.options.maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
      };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }
}

const AUTH_WINDOW_MS = 15 * 60 * 1_000;

export const loginRateLimiter = new FixedWindowRateLimiter({
  maxAttempts: 10,
  windowMs: AUTH_WINDOW_MS,
});

export const registerRateLimiter = new FixedWindowRateLimiter({
  maxAttempts: 5,
  windowMs: AUTH_WINDOW_MS,
});

export const requestAddress = (request: Request) =>
  request.headers.get("x-real-ip")?.trim()
  || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || "unknown";

export const authKey = (request: Request, username: string) =>
  `${requestAddress(request)}:${username.trim().toLocaleLowerCase()}`;

export const assertRateLimit = (result: ReturnType<FixedWindowRateLimiter["allow"]>) => {
  if (!result.allowed) {
    throw new ApplicationError("RATE_LIMITED", "请求过于频繁，请稍后再试", {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
};
