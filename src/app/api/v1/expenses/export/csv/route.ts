import { jsonError, serviceForRequest } from "@/lib/api/http";
import { serializeExpenseCsv } from "@/lib/expenses/csv";

export function GET(request: Request) {
  try {
    const data = serviceForRequest(request).exportExpenseData();
    const date = data.exportedAt.slice(0, 10);
    const csv = `\uFEFF${serializeExpenseCsv(data)}`;
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="personal-dashboard-expenses-export-${date}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
