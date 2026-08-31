import { z } from "zod";
import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";

const input = z.object({ name: z.string().min(1).max(100) }).strict();

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).listApiKeys()); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { return jsonData(serviceForRequest(request).createApiKey(input.parse(await readJson(request)).name), { status: 201 }); }
  catch (error) { return jsonError(error); }
}
