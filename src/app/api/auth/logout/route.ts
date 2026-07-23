import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/api/http";

export function POST() {
  const response = NextResponse.json({ data: null });
  return clearSessionCookie(response);
}
