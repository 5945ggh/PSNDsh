import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { z } from "zod";

const restoreSchema = z.object({}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    restoreSchema.parse(await readJson(request));
    const { id } = await context.params;
    return jsonData(serviceForRequest(request).restorePaymentMethod(id));
  } catch (error) {
    return jsonError(error);
  }
}
