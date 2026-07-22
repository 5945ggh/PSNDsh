import { z } from "zod";
import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";

const manualInput = z.object({
  startedAt: z.string(),
  endedAt: z.string(),
  note: z.string().nullable(),
  outcome: z.string().nullable(),
  entryId: z.string().nullable(),
});

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).getFocusSessions()); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { return jsonData(serviceForRequest(request).addManualFocusSession(manualInput.parse(await readJson(request))), { status: 201 }); } catch (error) { return jsonError(error); }
}
