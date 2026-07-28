import { z } from "zod";
import type { IcsImportRow } from "@/lib/domain/types";
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
    const imports = service.getScheduleImports();
    const existingImport = imports.find((item) =>
      item.sourceKey === parsed.sourceKey || (!item.sourceKey && item.fileName === input.fileName)
    );
    const existingBlocks = existingImport
      ? service.getScheduleBlocks().filter((block) => block.importId === existingImport.id)
      : [];
    const keyFor = (block: { sourceUid?: string | null; sourceInstanceKey?: string | null; startedAt: string }) =>
      block.sourceInstanceKey ?? `${block.sourceUid ?? "event"}:${block.startedAt}`;
    const desired = parsed.candidates.flatMap((candidate) => candidate.blocks.map((block) => ({
      ...block,
      sourceUid: block.sourceUid ?? candidate.sourceUid,
    })));
    const desiredKeys = new Set(desired.map(keyFor));
    const existingByKey = new Map(existingBlocks.map((block) => [keyFor(block), block]));
    const sameBlock = (left: typeof desired[number], right: typeof existingBlocks[number]) =>
      left.title.trim() === right.title
      && (left.description?.trim() || null) === right.description
      && left.startedAt === right.startedAt
      && left.endedAt === right.endedAt
      && (left.location?.trim() || null) === right.location
      && (left.colorKey ?? "purple") === (right.colorKey ?? "purple");
    const diff = { added: 0, updated: 0, removed: 0, cancelled: 0, unchanged: 0 };
    for (const block of desired) {
      const current = existingByKey.get(keyFor(block));
      if (!current) diff.added += 1;
      else if (sameBlock(block, current)) diff.unchanged += 1;
      else diff.updated += 1;
    }
    const inWindow = (startedAt: string) =>
      Date.parse(startedAt) >= Date.parse(parsed.syncWindow.from) && Date.parse(startedAt) < Date.parse(parsed.syncWindow.to);
    const removedSourceUids = new Set<string>();
    for (const current of existingBlocks) {
      if (inWindow(current.startedAt) && !desiredKeys.has(keyFor(current)) && current.sourceUid) {
        removedSourceUids.add(current.sourceUid);
      }
    }
    diff.removed = existingBlocks.filter((block) => inWindow(block.startedAt) && !desiredKeys.has(keyFor(block))).length;
    const cancelledUids = new Set(parsed.candidates.filter((candidate) => candidate.cancelled).map((candidate) => candidate.sourceUid));
    cancelledUids.forEach((uid) => removedSourceUids.add(uid));
    diff.cancelled = existingBlocks.filter((block) => block.sourceUid && cancelledUids.has(block.sourceUid) && inWindow(block.startedAt)).length;
    diff.removed = Math.max(0, diff.removed - diff.cancelled);

    const rows: IcsImportRow[] = parsed.preview.rows.map((row) => {
      const candidate = parsed.candidates.find((item) => item.sourceUid === row.sourceUid);
      const candidateBlocks = candidate?.blocks ?? [];
      const statuses = candidateBlocks.map((block) => {
        const normalizedBlock = { ...block, sourceUid: block.sourceUid ?? row.sourceUid };
        const current = existingByKey.get(keyFor(normalizedBlock));
        return !current ? "added" : sameBlock(normalizedBlock, current) ? "unchanged" : "updated";
      });
      const change: IcsImportRow["change"] = candidate?.cancelled
        ? "cancelled"
        : statuses.includes("updated")
          ? "updated"
          : statuses.includes("added")
            ? "added"
            : statuses.length > 0 ? "unchanged" : undefined;
      const duplicateCount = candidateBlocks.filter((block) => existingByKey.has(keyFor({ sourceUid: block.sourceUid ?? row.sourceUid, sourceInstanceKey: block.sourceInstanceKey, startedAt: block.startedAt }))).length;
      return {
        ...row,
        duplicateCount,
        change,
        selected: existingImport ? change !== "unchanged" : row.selected,
        warnings: duplicateCount > 0 && !existingImport
          ? [...row.warnings, `该源 UID 已导入 ${duplicateCount} 个实例，默认不重复写入。`]
          : row.warnings,
      };
    });
    const knownUids = new Set(parsed.candidates.map((candidate) => candidate.sourceUid));
    const cancelledSourceUids = parsed.candidates
      .filter((candidate) => candidate.cancelled)
      .map((candidate) => candidate.sourceUid);
    for (const sourceUid of cancelledSourceUids) {
      const cancelledBlocks = existingBlocks.filter((block) =>
        block.sourceUid === sourceUid && inWindow(block.startedAt)
      );
      if (cancelledBlocks.length === 0) continue;
      const first = cancelledBlocks[0]!;
      rows.push({
        sourceUid,
        title: first.title,
        startedAt: first.startedAt,
        endedAt: first.endedAt,
        location: first.location,
        description: first.description,
        recurrenceLabel: cancelledBlocks.length > 1 ? `确认后将删除 ${cancelledBlocks.length} 个实例` : null,
        selected: true,
        warnings: ["源文件已将此事件标记为取消，确认后将在当前同步窗口内删除。"],
        duplicateCount: cancelledBlocks.length,
        change: "cancelled",
      });
    }
    existingBlocks.filter((block) => block.sourceUid && removedSourceUids.has(block.sourceUid) && !knownUids.has(block.sourceUid))
      .slice(0, 200)
      .forEach((block) => {
        rows.push({
          sourceUid: block.sourceUid!,
          title: block.title,
          startedAt: block.startedAt,
          endedAt: block.endedAt,
          location: block.location,
          description: block.description,
          recurrenceLabel: null,
          selected: true,
          warnings: ["源文件中已不存在该实例，确认后将在当前同步窗口内删除。"],
          duplicateCount: 1,
          change: "removed",
        });
      });
    const importId = createIcsPreview(
      userId,
      input.fileName,
      parsed.sourceKey,
      parsed.sourceName,
      parsed.syncWindow,
      Array.from(removedSourceUids),
      parsed.candidates,
    );
    return jsonData({
      ...parsed.preview,
      rows,
      isUpdate: Boolean(existingImport),
      diff,
      importId,
    });
  } catch (error) {
    return jsonError(error);
  }
}
