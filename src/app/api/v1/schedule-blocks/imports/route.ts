import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).getScheduleImports()); } catch (error) { return jsonError(error); }
}
