import { z } from "zod";
import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";

const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), entryId: z.string() }),
  z.object({ action: z.literal("remove"), entryId: z.string() }),
  z.object({ action: z.literal("note"), note: z.string() }),
]);

export async function GET(request: Request, context: { params: Promise<{ weekStart: string }> }) {
  try {
    const weekStart = (await context.params).weekStart;
    return jsonData(serviceForRequest(request).getWeekPlan(weekStart === "current" ? undefined : weekStart));
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ weekStart: string }> }) {
  try {
    const params = await context.params;
    const weekStart = params.weekStart === "current" ? undefined : params.weekStart;
    const input = actionInput.parse(await readJson(request));
    const service = serviceForRequest(request);
    if (input.action === "add") service.addToWeekPlan(input.entryId, weekStart);
    if (input.action === "remove") service.removeFromWeekPlan(input.entryId, weekStart);
    if (input.action === "note") service.updateWeekPlanNote(input.note, weekStart);
    return jsonData(service.getWeekPlan(weekStart));
  } catch (error) { return jsonError(error); }
}
