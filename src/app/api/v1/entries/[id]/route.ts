import { z } from "zod";
import { jsonData, jsonError, noContent, readJson, serviceForRequest } from "@/lib/api/http";

const updateInput = z.object({
  parentId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  completionMode: z.enum(["ongoing", "completable"]).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
  dueAt: z.string().nullable().optional(),
  sortKey: z.string().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const entry = serviceForRequest(request).getEntryById((await context.params).id);
    return entry ? jsonData(entry) : new Response(null, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const input = updateInput.parse(await readJson(request));
    return jsonData(serviceForRequest(request).updateEntry((await context.params).id, input));
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    serviceForRequest(request).deleteEntry((await context.params).id);
    return noContent();
  } catch (error) { return jsonError(error); }
}
