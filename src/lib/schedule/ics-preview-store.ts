import { randomUUID } from "node:crypto";
import type { IcsImportCandidate } from "@/lib/schedule/ics-import";

const PREVIEW_TTL_MS = 15 * 60 * 1_000;

type StoredPreview = {
  userId: string;
  fileName: string;
  sourceKey: string;
  sourceName: string;
  syncWindow: { from: string; to: string };
  removedSourceUids: string[];
  expiresAt: number;
  candidates: IcsImportCandidate[];
};

const previews = new Map<string, StoredPreview>();
const previewKey = (userId: string, importId: string) => `${userId}:${importId}`;

export function createIcsPreview(userId: string, fileName: string, candidates: IcsImportCandidate[]): string;
export function createIcsPreview(
  userId: string,
  fileName: string,
  sourceKey: string,
  sourceName: string,
  syncWindow: { from: string; to: string },
  candidates: IcsImportCandidate[],
): string;
export function createIcsPreview(
  userId: string,
  fileName: string,
  sourceKey: string,
  sourceName: string,
  syncWindow: { from: string; to: string },
  removedSourceUids: string[],
  candidates: IcsImportCandidate[],
): string;
export function createIcsPreview(
  userId: string,
  fileName: string,
  sourceKeyOrCandidates: string | IcsImportCandidate[],
  sourceName?: string,
  syncWindow?: { from: string; to: string },
  removedSourceUidsOrCandidates?: string[] | IcsImportCandidate[],
  candidatesArg?: IcsImportCandidate[],
) {
  const legacy = Array.isArray(sourceKeyOrCandidates);
  const sourceKey = legacy ? undefined : sourceKeyOrCandidates;
  const isUidList = (value: string[] | IcsImportCandidate[] | undefined): value is string[] =>
    Array.isArray(value) && (value.length === 0 || typeof value[0] === "string");
  const removedSourceUids: string[] = !legacy && isUidList(removedSourceUidsOrCandidates)
    ? removedSourceUidsOrCandidates
    : [];
  const candidates: IcsImportCandidate[] = legacy
    ? sourceKeyOrCandidates
    : candidatesArg ?? (!isUidList(removedSourceUidsOrCandidates) ? removedSourceUidsOrCandidates ?? [] : []);
  const importId = randomUUID();
  previews.set(previewKey(userId, importId), {
    userId,
    fileName,
    sourceKey: sourceKey ?? "",
    sourceName: sourceName ?? fileName,
    syncWindow: syncWindow ?? { from: "", to: "" },
    removedSourceUids,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
    candidates,
  });
  return importId;
};

export const consumeIcsPreview = (userId: string, importId: string) => {
  const key = previewKey(userId, importId);
  const preview = previews.get(key);
  previews.delete(key);
  if (!preview || preview.userId !== userId || preview.expiresAt <= Date.now()) return null;
  const result = {
    fileName: preview.fileName,
    candidates: preview.candidates,
  };
  if (preview.sourceKey) {
    return {
      ...result,
      sourceKey: preview.sourceKey,
      sourceName: preview.sourceName,
      syncWindow: preview.syncWindow,
      removedSourceUids: preview.removedSourceUids,
    };
  }
  return result;
};

export const __resetIcsPreviewStoreForTests = () => previews.clear();
