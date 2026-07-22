import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/api/http";

export function POST() {
  const response = NextResponse.json({ data: null });
  response.cookies.set(USER_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
