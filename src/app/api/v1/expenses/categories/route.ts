import { assertSameOrigin, jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";
import { dimensionCreateSchema, readIncludeArchived } from "../_dimension-route";

export function GET(request: Request) {
  try {
    return jsonData(serviceForRequest(request).getExpenseCategories(readIncludeArchived(request)));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return jsonData(serviceForRequest(request).createExpenseCategory(dimensionCreateSchema.parse(await readJson(request))), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
