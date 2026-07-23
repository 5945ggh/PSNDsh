import { assertSameOrigin, jsonData, jsonError, noContent, readJson, serviceForRequest } from "@/lib/api/http";
import { updateScheduleInput } from "@/lib/api/schedule-input";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return jsonData(serviceForRequest(request).updateScheduleBlock(
      (await context.params).id,
      updateScheduleInput.parse(await readJson(request))
    ));
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    serviceForRequest(request).deleteScheduleBlock((await context.params).id);
    return noContent();
  } catch (error) { return jsonError(error); }
}
