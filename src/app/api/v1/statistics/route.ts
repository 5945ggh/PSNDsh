import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";

export function GET(request: Request) {
  try {
    const scale = new URL(request.url).searchParams.get("scale") as "day" | "week" | "month" | null;
    return jsonData(serviceForRequest(request).getStatisticsPayload(scale ?? "week"));
  } catch (error) { return jsonError(error); }
}
