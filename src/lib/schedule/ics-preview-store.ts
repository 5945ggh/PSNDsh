import { randomUUID } from "node:crypto";
import type { IcsImportCandidate } from "@/lib/schedule/ics-import";

const PREVIEW_TTL_MS = 15 * 60 * 1_000;

type StoredPreview = { userId: string; expiresAt: number; candidates: IcsImportCandidate[] };

const previews = new Map<string, StoredPreview>();
const previewKey = (userId: string, importId: string) => `${userId}:${importId}`;

export const createIcsPreview = (userId: string, candidates: IcsImportCandidate[]) => {
  const importId = randomUUID();
  previews.set(previewKey(userId, importId), { userId, expiresAt: Date.now() + PREVIEW_TTL_MS, candidates });
  return importId;
};

export const consumeIcsPreview = (userId: string, importId: string) => {
  const key = previewKey(userId, importId);
  const preview = previews.get(key);
  previews.delete(key);
  if (!preview || preview.userId !== userId || preview.expiresAt <= Date.now()) return null;
  return preview.candidates;
};

export const __resetIcsPreviewStoreForTests = () => previews.clear();
