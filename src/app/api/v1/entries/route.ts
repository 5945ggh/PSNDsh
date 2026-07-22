import { z } from "zod";
import { jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";

const entryInput = z.object({
  parentId: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  completionMode: z.enum(["ongoing", "completable"]),
  dueAt: z.string().nullable(),
});

export function GET(request: Request) {
  try { return jsonData(serviceForRequest(request).getEntries()); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const input = entryInput.parse(await readJson(request));
    return jsonData(serviceForRequest(request).addEntry(input), { status: 201 });
  } catch (error) { return jsonError(error); }
}
