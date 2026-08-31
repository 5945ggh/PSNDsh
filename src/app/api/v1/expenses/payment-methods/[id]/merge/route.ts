import { assertSameOrigin, jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { dimensionMergeSchema } from "../../../_dimension-route";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const input = dimensionMergeSchema.parse(await readJson(request));
    const { id } = await context.params;
    return jsonData(serviceForRequest(request).mergePaymentMethod(id, input));
  } catch (error) {
    return jsonError(error);
  }
}
