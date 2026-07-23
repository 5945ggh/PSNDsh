import { z } from "zod";
import { jsonData, jsonError, readJson, sessionUserIdForRequest, serviceForRequest } from "@/lib/api/http";
import { createIcsPreview } from "@/lib/schedule/ics-preview-store";
import { parseIcsImport } from "@/lib/schedule/ics-import";
import { ApplicationError } from "@/lib/application/error";

const previewRequest = z.object({
  fileName: z.string().trim().min(1).max(255),
  content: z.string().min(1).max(1_024 * 1_024),
}).strict();

export async function POST(request: Request) {
  try {
    const userId = sessionUserIdForRequest(request);
    if (!userId) throw new ApplicationError("UNAUTHORIZED", "当前没有登录用户");
    const input = previewRequest.parse(await readJson(request));
    const service = serviceForRequest(request);
    const parsed = await parseIcsImport(input.fileName, input.content, {
      effectiveTimezone: service.getCapabilities().effectiveTimezone,
    });
    const existingCounts = new Map<string, number>();
    for (const block of service.getScheduleBlocks()) {
      if (block.sourceUid) existingCounts.set(block.sourceUid, (existingCounts.get(block.sourceUid) ?? 0) + 1);
    }
    const rows = parsed.preview.rows.map((row) => {
      const duplicateCount = existingCounts.get(row.sourceUid) ?? 0;
      return {
        ...row,
        duplicateCount,
        selected: duplicateCount === 0 && row.selected,
        warnings: duplicateCount > 0
          ? [...row.warnings, `该源 UID 已导入 ${duplicateCount} 个实例，默认不重复写入。`]
          : row.warnings,
      };
    });
    return jsonData({ ...parsed.preview, rows, importId: createIcsPreview(userId, input.fileName, parsed.candidates) });
  } catch (error) {
    return jsonError(error);
  }
}
