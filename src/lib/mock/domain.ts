import { Entry, EntryStatus, FocusSegment, FocusSession } from "@/types/mock";
import { ApplicationError } from "@/lib/application/error";

export const MockDomainError = ApplicationError;
export type MockErrorCode = ConstructorParameters<typeof ApplicationError>[0];

const toMilliseconds = (value: string): number => new Date(value).getTime();

const assertValidRange = (startedAt: string, endedAt: string) => {
  const start = toMilliseconds(startedAt);
  const end = toMilliseconds(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new MockDomainError(
      "SEGMENTS_INVALID_PARTITION",
      "时间范围必须是有效的正向区间"
    );
  }
  return { start, end };
};

export const assertEntryMoveIsValid = (
  entries: Entry[],
  entryId: string,
  newParentId: string | null
) => {
  const entry = entries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    throw new MockDomainError("ENTRY_NOT_FOUND", "条目不存在");
  }
  if (newParentId === null) return;

  const parent = entries.find((candidate) => candidate.id === newParentId);
  if (!parent) {
    throw new MockDomainError("ENTRY_NOT_FOUND", "目标父条目不存在");
  }
  if (newParentId === entryId) {
    throw new MockDomainError("ENTRY_MOVE_INVALID", "条目不能移动到自身之下");
  }

  const descendants = new Set<string>();
  const visitChildren = (parentId: string) => {
    for (const child of entries.filter((candidate) => candidate.parentId === parentId)) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        visitChildren(child.id);
      }
    }
  };
  visitChildren(entryId);

  if (descendants.has(newParentId)) {
    throw new MockDomainError(
      "ENTRY_MOVE_INVALID",
      "条目不能移动到自己的后代之下"
    );
  }
};

export const assertEntryStatusIsValid = (entry: Entry, status: EntryStatus) => {
  if (entry.completionMode === "ongoing" && status === "completed") {
    throw new MockDomainError(
      "ENTRY_STATUS_INVALID",
      "持续型条目不能标记为已完成"
    );
  }
};

export const assertNoFocusOverlap = (
  sessions: FocusSession[],
  startedAt: string,
  endedAt: string,
  ignoredSessionId?: string
) => {
  const target = assertValidRange(startedAt, endedAt);
  for (const session of sessions) {
    if (!session.endedAt || session.id === ignoredSessionId) continue;
    const candidate = assertValidRange(session.startedAt, session.endedAt);
    if (target.start < candidate.end && target.end > candidate.start) {
      throw new MockDomainError(
        "FOCUS_OVERLAP",
        "该时段与已有专注记录重叠",
        { sessionId: session.id, startedAt: session.startedAt, endedAt: session.endedAt }
      );
    }
  }
};

export const assertSegmentsPartitionSession = (
  session: Pick<FocusSession, "startedAt"> & { endedAt: string },
  segments: FocusSegment[]
) => {
  const sessionRange = assertValidRange(session.startedAt, session.endedAt);
  if (segments.length === 0) {
    throw new MockDomainError(
      "SEGMENTS_INVALID_PARTITION",
      "专注会话至少需要一个片段"
    );
  }

  let cursor = sessionRange.start;
  for (const segment of segments) {
    const range = assertValidRange(segment.startedAt, segment.endedAt);
    if (range.start !== cursor || range.start < sessionRange.start || range.end > sessionRange.end) {
      throw new MockDomainError(
        "SEGMENTS_INVALID_PARTITION",
        "片段必须按顺序无缝覆盖整个专注会话"
      );
    }
    cursor = range.end;
  }

  if (cursor !== sessionRange.end) {
    throw new MockDomainError(
      "SEGMENTS_INVALID_PARTITION",
      "片段必须完整覆盖整个专注会话"
    );
  }
};
