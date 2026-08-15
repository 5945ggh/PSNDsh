import { z } from "zod";
import { assertSameOrigin, jsonData, jsonError, noContent, readJson, serviceForRequest } from "@/lib/api/http";

const stopInput = z.object({
  action: z.enum(["start", "stop"]),
  entryId: z.string().nullable().optional(),
  sessionId: z.string().optional(),
  outcome: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  segments: z.array(z.object({ id: z.string(), startedAt: z.string(), endedAt: z.string(), entryId: z.string().nullable(), note: z.string().nullable() })).optional(),
});

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).getActiveFocus()); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const input = stopInput.parse(await readJson(request));
    const service = serviceForRequest(request);
    if (input.action === "start") return jsonData(service.startFocusSession(input.entryId), { status: 201 });
    return jsonData(service.stopFocusSession(input.sessionId as string, input.outcome ?? null, input.note ?? null, input.segments ?? []));
  } catch (error) { return jsonError(error); }
}

export function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    serviceForRequest(request).discardFocusSession();
    return noContent();
  } catch (error) { return jsonError(error); }
}
