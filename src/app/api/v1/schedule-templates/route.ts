import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { scheduleTemplateInput } from "@/lib/api/schedule-template-input";

export function GET(request: Request) {
  try {
    return jsonData(serviceForRequest(request).getScheduleTemplates());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = scheduleTemplateInput.parse(await readJson(request));
    return jsonData(serviceForRequest(request).createScheduleTemplate({
      ...input,
      description: input.description ?? null,
      items: input.items.map((item) => ({
        ...item,
        description: item.description ?? null,
        location: item.location ?? null,
        colorKey: item.colorKey ?? null,
      })),
    }), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
