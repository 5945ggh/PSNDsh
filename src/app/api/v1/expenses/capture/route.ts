import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiKeyServiceForRequest, jsonData, jsonError } from "@/lib/api/http";
import { ApplicationError } from "@/lib/application/error";
import { assertRateLimit, requestAddress, FixedWindowRateLimiter } from "@/lib/security/rate-limit";

const limiter = new FixedWindowRateLimiter({ maxAttempts: 120, windowMs: 60_000 });
const optionalUuid = z.preprocess(
  (value) => value === null || (typeof value === "string" && value.trim() === "") ? undefined : value,
  z.string().uuid().optional(),
);
const amountCents = z.preprocess((value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const rounded = Math.round(value);
  // Shortcuts may leave a harmless IEEE-754 tail after multiplying yuan by 100
  // (for example, 1250.0000000000002). Keep the tolerance fixed so large
  // amounts cannot turn a real fractional cent into an integer.
  const epsilon = 1e-9;
  return Math.abs(value - rounded) <= epsilon ? rounded : value;
}, z.number().int().positive().safe());
const inputSchema = z.object({
  // Shortcuts cannot reliably generate a UUID. An omitted/blank id is assigned
  // one here, while a caller-provided id retains idempotent retry semantics.
  id: optionalUuid,
  amount_cents: amountCents,
  currency: z.string().optional(),
  occurred_at: z.string().optional(),
  occurred_on: z.string().optional(),
  occurred_timezone: z.string().nullable().optional().refine((value) => {
    if (value === undefined || value === null) return true;
    try { Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
  }, "发生时区无效"),
  occurrence_precision: z.enum(["datetime", "date"]).optional(),
  capture_message: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    assertRateLimit(limiter.allow(`${requestAddress(request)}:expense-capture`));
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApplicationError("REQUEST_INVALID", "请求体必须是有效 JSON"); }
    const input = inputSchema.parse(body);
    const result = apiKeyServiceForRequest(request).captureExpense({
      id: input.id ?? randomUUID(),
      amountCents: input.amount_cents,
      currency: input.currency as "CNY" | undefined,
      occurredAt: input.occurred_at,
      occurredOn: input.occurred_on,
      occurredTimezone: input.occurred_timezone,
      occurrencePrecision: input.occurrence_precision,
      captureMessage: input.capture_message,
      // Location is supplemental capture data. Out-of-range coordinates are
      // discarded instead of making an otherwise valid low-friction capture fail.
      latitude: input.latitude !== null && (input.latitude === undefined || input.latitude < -90 || input.latitude > 90) ? undefined : input.latitude,
      longitude: input.longitude !== null && (input.longitude === undefined || input.longitude < -180 || input.longitude > 180) ? undefined : input.longitude,
    });
    return jsonData(result.expense, { status: result.created ? 201 : 200 });
  } catch (error) { return jsonError(error); }
}
