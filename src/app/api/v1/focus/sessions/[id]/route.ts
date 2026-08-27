import { z } from "zod";
import { assertSameOrigin, jsonData, jsonError, readJson, serviceForRequest } from "@/lib/api/http";

const updateInput = z.object({
  segments: z.array(z.object({
    id: z.string(),
    startedAt: z.string(),
    endedAt: z.string(),
    entryId: z.string().nullable(),
    note: z.string().nullable(),
  })),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = updateInput.parse(await readJson(request));
    return jsonData(serviceForRequest(request).updateFocusSession(id, input.segments));
  } catch (error) {
    return jsonError(error);
  }
}
