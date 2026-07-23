import { assertSameOrigin, jsonData, jsonError, noContent, readJson, serviceForRequest } from "@/lib/api/http";
import { scheduleTemplateInput } from "@/lib/api/schedule-template-input";

const parseInput = async (request: Request) => {
  const input = scheduleTemplateInput.parse(await readJson(request));
  return {
    ...input,
    description: input.description ?? null,
    items: input.items.map((item) => ({
      ...item,
      description: item.description ?? null,
      location: item.location ?? null,
      colorKey: item.colorKey ?? null,
    })),
  };
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return jsonData(serviceForRequest(request).updateScheduleTemplate(
      (await context.params).id,
      await parseInput(request),
    ));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    serviceForRequest(request).deleteScheduleTemplate((await context.params).id);
    return noContent();
  } catch (error) {
    return jsonError(error);
  }
}
