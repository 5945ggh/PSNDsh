import { NextResponse } from "next/server";
import { z } from "zod";
import { USER_COOKIE, jsonError, readJson } from "@/lib/api/http";
import { getRuntimeDatabase } from "@/lib/db";
import { SqliteApplicationService } from "@/lib/persistence/sqlite-service";

const inputSchema = z.object({ username: z.string().min(1), password: z.string() });

export async function POST(request: Request) {
  try {
    const service = new SqliteApplicationService(getRuntimeDatabase(), { userId: null });
    const session = service.login(inputSchema.parse(await readJson(request)));
    const response = NextResponse.json({ data: session });
    response.cookies.set(USER_COOKIE, session.user?.id ?? "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    return response;
  } catch (error) { return jsonError(error); }
}
