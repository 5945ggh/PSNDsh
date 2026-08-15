import { z } from "zod";
import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { weekStartSchema } from "@/lib/application/contract";

const actionInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    entryId: z.string(),
    role: z.enum(["focus", "commitment"]).optional(),
    plannedFocusSeconds: z.number().int().nonnegative().nullable().optional(),
  }),
  z.object({
    action: z.literal("update"),
    entryId: z.string(),
    role: z.enum(["focus", "commitment"]),
    plannedFocusSeconds: z.number().int().nonnegative().nullable(),
  }).refine((input) => input.role === "focus" || input.plannedFocusSeconds === null, {
    path: ["plannedFocusSeconds"],
    message: "commitment 条目不能设置预计投入时间",
  }),
  z.object({ action: z.literal("remove"), entryId: z.string() }),
  z.object({ action: z.literal("note"), note: z.string() }),
]);

export async function GET(request: Request, context: { params: Promise<{ weekStart: string }> }) {
  try {
    const weekStartParam = (await context.params).weekStart;
    const create = new URL(request.url).searchParams.get("create") !== "false";
    const service = serviceForRequest(request);
    if (weekStartParam === "current") {
      return jsonData(service.getWeekPlan());
    }
    const weekStart = weekStartSchema.parse(weekStartParam);
    return jsonData(create ? service.getWeekPlan(weekStart) : service.getExistingWeekPlan(weekStart));
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ weekStart: string }> }) {
  try {
    const params = await context.params;
    const weekStart = params.weekStart === "current" ? undefined : weekStartSchema.parse(params.weekStart);
    const input = actionInput.parse(await readJson(request));
    const service = serviceForRequest(request);
    if (input.action === "add") service.addToWeekPlan(input.entryId, weekStart, {
      role: input.role,
      plannedFocusSeconds: input.plannedFocusSeconds,
    });
    if (input.action === "update") service.updateWeekPlanItem(input.entryId, {
      role: input.role,
      plannedFocusSeconds: input.plannedFocusSeconds,
    }, weekStart);
    if (input.action === "remove") service.removeFromWeekPlan(input.entryId, weekStart);
    if (input.action === "note") service.updateWeekPlanNote(input.note, weekStart);
    return jsonData(service.getWeekPlan(weekStart));
  } catch (error) { return jsonError(error); }
}
