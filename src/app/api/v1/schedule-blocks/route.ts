import { z } from "zod";
import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";

const recurrence = z.object({
  frequency: z.literal("weekly"),
  interval: z.number().int().positive(),
  weekdays: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])),
  until: z.string().nullable(),
}).nullable();

const scheduleInput = z.object({
  kind: z.enum(["course", "plan", "other"]),
  title: z.string().min(1),
  startedAt: z.string(),
  endedAt: z.string(),
  location: z.string().nullable(),
  colorKey: z.string().nullable(),
  recurrence,
});

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).getScheduleBlocks()); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { return jsonData(serviceForRequest(request).addScheduleBlock(scheduleInput.parse(await readJson(request))), { status: 201 }); } catch (error) { return jsonError(error); }
}
