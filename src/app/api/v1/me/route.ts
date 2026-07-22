import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).getUser()); } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    const input = await readJson(request) as { nickname?: string | null; email?: string | null };
    return jsonData(serviceForRequest(request).updateUserProfile(input.nickname ?? null, input.email ?? null));
  } catch (error) { return jsonError(error); }
}
