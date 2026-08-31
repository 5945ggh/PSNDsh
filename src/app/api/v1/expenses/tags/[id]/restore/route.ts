import { assertSameOrigin, jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { z } from "zod";

const restoreSchema = z.object({}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    restoreSchema.parse(await readJson(request));
    const { id } = await context.params;
    return jsonData(serviceForRequest(request).restoreExpenseTag(id));
  } catch (error) {
    return jsonError(error);
  }
}
