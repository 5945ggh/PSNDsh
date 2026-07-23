import { jsonError, noContent, serviceForRequest } from "@/lib/api/http";

export async function DELETE(request: Request, { params }: { params: Promise<{ importId: string }> }) {
  try {
    serviceForRequest(request).deleteScheduleImport((await params).importId);
    return noContent();
  } catch (error) { return jsonError(error); }
}
