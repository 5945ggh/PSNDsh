import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { scheduleInput } from "@/lib/api/schedule-input";

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).getScheduleBlocks()); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { return jsonData(serviceForRequest(request).addScheduleBlock(scheduleInput.parse(await readJson(request))), { status: 201 }); } catch (error) { return jsonError(error); }
}
