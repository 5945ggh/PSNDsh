import { jsonData, jsonError, readJson, serviceForRequest, assertSameOrigin } from "@/lib/api/http";
import { dimensionCreateSchema } from "../../_dimension-route";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return jsonData(serviceForRequest(request).renameExpenseCategory(id, dimensionCreateSchema.parse(await readJson(request))));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    return jsonData(serviceForRequest(request).archiveExpenseCategory(id));
  } catch (error) {
    return jsonError(error);
  }
}
