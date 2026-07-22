import { NextResponse } from "next/server";
import { getRuntimeDatabase } from "@/lib/db";
import { SqliteApplicationService } from "@/lib/persistence/sqlite-service";
import { jsonError } from "@/lib/api/http";

export function GET() {
  try {
    return NextResponse.json({ data: new SqliteApplicationService(getRuntimeDatabase(), { userId: null }).getCapabilities() });
  } catch (error) {
    return jsonError(error);
  }
}
