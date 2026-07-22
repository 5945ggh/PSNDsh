import { jsonError, noContent, serviceForRequest } from "@/lib/api/http";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    serviceForRequest(request).deleteScheduleBlock((await context.params).id);
    return noContent();
  } catch (error) { return jsonError(error); }
}
