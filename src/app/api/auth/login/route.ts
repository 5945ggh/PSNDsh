import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, setSessionCookie } from "@/lib/api/http";
import { getRuntimeDatabase } from "@/lib/db";
import { SqliteApplicationService } from "@/lib/persistence/sqlite-service";
import { assertRateLimit, authKey, loginRateLimiter } from "@/lib/security/rate-limit";

const inputSchema = z.object({ username: z.string().min(1), password: z.string() });

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await readJson(request));
    const key = authKey(request, input.username);
    assertRateLimit(loginRateLimiter.allow(key));
    const service = new SqliteApplicationService(getRuntimeDatabase(), { userId: null });
    const session = service.login(input);
    loginRateLimiter.reset(key);
    const response = NextResponse.json({ data: session });
    return setSessionCookie(response, session.user!.id);
  } catch (error) { return jsonError(error); }
}
