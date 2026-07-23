import { z } from "zod";
import { jsonData, jsonError, readJson, sessionUserIdForRequest, serviceForRequest } from "@/lib/api/http";
import { consumeIcsPreview } from "@/lib/schedule/ics-preview-store";
import { ApplicationError } from "@/lib/application/error";

const confirmRequest = z.object({
  selectedSourceUids: z.array(z.string().trim().min(1)).max(200),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ importId: string }> }) {
  try {
    const userId = sessionUserIdForRequest(request);
    if (!userId) throw new ApplicationError("UNAUTHORIZED", "当前没有登录用户");
    const input = confirmRequest.parse(await readJson(request));
    const { importId } = await params;
    const candidates = consumeIcsPreview(userId, importId);
    if (!candidates) throw new ApplicationError("ICS_PREVIEW_EXPIRED", "导入预览已失效，请重新解析文件");
    const selected = new Set(input.selectedSourceUids);
    const blocks = candidates.filter((candidate) => selected.has(candidate.sourceUid)).flatMap((candidate) => candidate.blocks);
    return jsonData(serviceForRequest(request).importIcsScheduleBlocks(blocks), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
