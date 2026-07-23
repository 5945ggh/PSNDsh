import { jsonError, serviceForRequest } from "@/lib/api/http";

export function GET(request: Request) {
  try {
    const data = serviceForRequest(request).exportUserData();
    const date = data.exportedAt.slice(0, 10);
    return new Response(JSON.stringify({ data }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="personal-dashboard-export-${date}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
