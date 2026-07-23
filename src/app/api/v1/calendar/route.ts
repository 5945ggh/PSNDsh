import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";
import { calendarRangeInput } from "@/lib/api/schedule-input";

export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = calendarRangeInput.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return jsonData(serviceForRequest(request).getCalendarPayload(range.from, range.to));
  } catch (error) { return jsonError(error); }
}
