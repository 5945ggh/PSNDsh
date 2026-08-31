import { assertSameOrigin, jsonData, jsonError, noContent, serviceForRequest } from "@/lib/api/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    return jsonData({ id, apiKey: serviceForRequest(request).revealApiKey(id) });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    serviceForRequest(request).revokeApiKey((await context.params).id);
    return noContent();
  } catch (error) { return jsonError(error); }
}
