import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApplicationError } from "@/lib/application/error";
import { getRuntimeDatabase } from "@/lib/db";
import { SqliteApplicationService } from "@/lib/persistence/sqlite-service";

export const SESSION_COOKIE = "pd-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEVELOPMENT_SESSION_SECRET = "personal-dashboard-development-session-secret";

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

const sessionSecret = () => {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production");
  }
  return DEVELOPMENT_SESSION_SECRET;
};

const normalizedOrigin = (value: string) => value.trim().replace(/\/$/, "");
export const SAME_ORIGIN_HEADER = "x-pd-same-origin";

export const assertSameOrigin = (request: Request) => {
  if (request.headers.get(SAME_ORIGIN_HEADER) === "1") return;
  const origin = request.headers.get("origin")?.trim();
  const referer = request.headers.get("referer")?.trim();
  let candidate = origin ?? null;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      throw new ApplicationError("CSRF_INVALID", "写请求来源无效");
    }
  }
  const expected = normalizedOrigin(
    process.env.PUBLIC_ORIGIN?.trim()
      || process.env.PUBLIC_BASE_URL?.trim()
      || new URL(request.url).origin
  );

  if (!candidate || candidate === "null") {
    throw new ApplicationError("CSRF_INVALID", "写请求必须来自同源页面");
  }

  let candidateOrigin: string;
  try {
    candidateOrigin = normalizedOrigin(new URL(candidate).origin);
  } catch {
    throw new ApplicationError("CSRF_INVALID", "写请求来源无效");
  }

  if (candidateOrigin !== expected) {
    throw new ApplicationError("CSRF_INVALID", "写请求来源不受信任");
  }
};

const signSession = (payload: string) =>
  createHmac("sha256", sessionSecret()).update(payload).digest("base64url");

const readCookie = (request: Request, name: string) => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return null;
  }
};

export const createSessionToken = (userId: string, now = Date.now()) => {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: now + SESSION_TTL_SECONDS * 1_000,
  } satisfies SessionPayload)).toString("base64url");
  return `${payload}.${signSession(payload)}`;
};

export const sessionUserIdForRequest = (request: Request, now = Date.now()) => {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const [encodedPayload, signature, ...unexpectedParts] = token.split(".");
  if (!encodedPayload || !signature || unexpectedParts.length > 0) return null;

  const expectedSignature = signSession(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    return typeof payload.userId === "string" && payload.userId.length > 0 && Number.isFinite(payload.expiresAt) && payload.expiresAt > now
      ? payload.userId
      : null;
  } catch {
    return null;
  }
};

export const setSessionCookie = (response: NextResponse, userId: string) => {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
};

export const serviceForRequest = (request: Request) => {
  return new SqliteApplicationService(getRuntimeDatabase(), {
    userId: sessionUserIdForRequest(request),
  });
};

export const jsonData = (data: unknown, init?: ResponseInit) =>
  NextResponse.json({ data }, init);

export const noContent = () => new Response(null, { status: 204 });

export const jsonError = (error: unknown) => {
  if (error instanceof ApplicationError) {
    const status = error.code === "RATE_LIMITED"
      ? 429
      : error.code === "CSRF_INVALID" || error.code === "REGISTRATION_CLOSED"
        ? 403
        : error.code === "UNAUTHORIZED" || error.code === "INVALID_CREDENTIALS"
          ? 401
          : error.code.endsWith("_NOT_FOUND")
            ? 404
            : error.code === "PASSWORD_TOO_WEAK" || error.code === "PASSWORD_MISMATCH" || error.code === "REQUEST_INVALID" || error.code === "ICS_PARSE_FAILED"
              ? 400
              : 409;
    const response = NextResponse.json({
      error: {
        code: error.code,
        message: error.message.replace(`${error.code}: `, ""),
        details: error.details ?? {},
      },
    }, { status });
    if (error.code === "RATE_LIMITED") {
      response.headers.set("Retry-After", String(error.details?.retryAfterSeconds ?? 60));
    }
    return response;
  }
  if (error instanceof ZodError) {
    return NextResponse.json({
      error: {
        code: "REQUEST_INVALID",
        message: "请求参数无效",
        details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      },
    }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({
    error: { code: "INTERNAL_ERROR", message: "服务暂时不可用", details: {} },
  }, { status: 500 });
};

export const readJson = async (request: Request) => {
  assertSameOrigin(request);
  try {
    return await request.json() as unknown;
  } catch {
    throw new ApplicationError("REQUEST_INVALID", "请求体必须是有效 JSON");
  }
};
