import { z } from "zod";
import { assertSameOrigin, jsonData, jsonError, noContent, readJson, serviceForRequest } from "@/lib/api/http";
import { ApplicationError } from "@/lib/application/error";

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
    if (!entry) throw new ApplicationError("ENTRY_NOT_FOUND", "条目不存在");
    return jsonData(entry);
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
    assertSameOrigin(request);
    serviceForRequest(request).deleteEntry((await context.params).id);
    return noContent();
  } catch (error) { return jsonError(error); }
}
