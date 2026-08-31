import { ApplicationError } from "@/lib/application/error";
import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";

export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const before = url.searchParams.get("before") ?? undefined;
    const rawLimit = url.searchParams.get("limit");
    if (rawLimit === null && !before) return jsonData(serviceForRequest(request).getExpenses());
    const limit = rawLimit === null ? 25 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ApplicationError("REQUEST_INVALID", "limit 必须是 1 到 100 之间的整数");
    }
    return jsonData(serviceForRequest(request).getExpenseHistoryPage(limit, before));
  } catch (error) { return jsonError(error); }
}
