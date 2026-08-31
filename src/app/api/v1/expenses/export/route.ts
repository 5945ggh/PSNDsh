import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";

export function GET(request: Request) {
  try {
    const data = serviceForRequest(request).exportExpenseData();
    const date = data.exportedAt.slice(0, 10);
    return jsonData(data, {
      headers: {
        "content-disposition": `attachment; filename="personal-dashboard-expenses-export-${date}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
