import { NextResponse } from "next/server";
import { assertSameOrigin, clearSessionCookie, jsonError } from "@/lib/api/http";

export function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return jsonError(error);
  }
  const response = NextResponse.json({ data: null });
  return clearSessionCookie(response);
}
