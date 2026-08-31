import { ApplicationError } from "@/lib/application/error";
import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";

const assertDateKey = (value: string, message: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApplicationError("REQUEST_INVALID", message);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApplicationError("REQUEST_INVALID", message);
  }
};

export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const before = url.searchParams.get("before") ?? undefined;
    const rawLimit = url.searchParams.get("limit");
    const query = {
      q: url.searchParams.get("q") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      paymentMethodId: url.searchParams.get("paymentMethodId") ?? undefined,
      tagId: url.searchParams.get("tagId") ?? undefined,
      reviewStatus: (url.searchParams.get("reviewStatus") as "pending" | "reviewed" | null) ?? undefined,
    };
    if (query.from) assertDateKey(query.from, "from 日期无效");
    if (query.to) assertDateKey(query.to, "to 日期无效");
    if (query.reviewStatus && !["pending", "reviewed"].includes(query.reviewStatus)) throw new ApplicationError("REQUEST_INVALID", "reviewStatus 无效");
    const hasQuery = Object.values(query).some(Boolean);
    if (rawLimit === null && !before && !hasQuery) return jsonData(serviceForRequest(request).getExpenses());
    const limit = rawLimit === null ? 25 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ApplicationError("REQUEST_INVALID", "limit 必须是 1 到 100 之间的整数");
    }
    return jsonData(serviceForRequest(request).getExpenseHistoryPage(limit, before, query));
  } catch (error) { return jsonError(error); }
}
