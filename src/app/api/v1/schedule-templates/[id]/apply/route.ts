import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { scheduleTemplateDateRangeInput } from "@/lib/api/schedule-template-input";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const input = scheduleTemplateDateRangeInput.parse(await readJson(request));
    return jsonData(serviceForRequest(request).applyScheduleTemplate(
      (await context.params).id,
      input.fromDate,
      input.toDate,
    ), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
