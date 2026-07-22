import { NextResponse } from "next/server";
import { ApplicationError } from "@/lib/application/error";
import { getRuntimeDatabase } from "@/lib/db";
import { SqliteApplicationService } from "@/lib/persistence/sqlite-service";

export const USER_COOKIE = "pd-user-id";

export const serviceForRequest = (request: Request) => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieUserId = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === USER_COOKIE)?.[1];
  const userId = request.headers.get("x-user-id") ?? cookieUserId ?? null;
  return new SqliteApplicationService(getRuntimeDatabase(), { userId });
};

export const jsonData = (data: unknown, init?: ResponseInit) =>
  NextResponse.json({ data }, init);

export const noContent = () => new Response(null, { status: 204 });

export const jsonError = (error: unknown) => {
  if (error instanceof ApplicationError) {
    const status = error.code === "UNAUTHORIZED" ? 401 : error.code.endsWith("_NOT_FOUND") ? 404 : 409;
    return NextResponse.json({ error: { code: error.code, message: error.message.replace(`${error.code}: `, ""), details: error.details } }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "服务暂时不可用" } }, { status: 500 });
};

export const readJson = async (request: Request) => {
  try {
    return await request.json() as unknown;
  } catch {
    throw new ApplicationError("SEGMENTS_INVALID_PARTITION", "请求体必须是有效 JSON");
  }
};
