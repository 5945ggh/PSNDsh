import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";

export function GET(request: Request) {
  try {
    const service = serviceForRequest(request);
    return jsonData({ scheduleBlocks: service.getScheduleBlocks(), focusSessions: service.getFocusSessions() });
  } catch (error) { return jsonError(error); }
}
