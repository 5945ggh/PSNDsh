import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { scheduleTemplateDateRangeInput } from "@/lib/api/schedule-template-input";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const input = scheduleTemplateDateRangeInput.parse(await readJson(request));
    return jsonData(serviceForRequest(request).previewScheduleTemplate(
      (await context.params).id,
      input.fromDate,
      input.toDate,
    ));
  } catch (error) {
    return jsonError(error);
  }
}
