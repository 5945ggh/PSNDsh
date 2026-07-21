import { describe, expect, it } from "vitest";
import {
  assertEntryMoveIsValid,
  assertEntryStatusIsValid,
  assertNoFocusOverlap,
  assertSegmentsPartitionSession,
  MockDomainError,
} from "./domain";
import { Entry, FocusSegment, FocusSession } from "@/types/mock";

const entries: Entry[] = [
  {
    id: "root",
    parentId: null,
    title: "根条目",
    description: null,
    completionMode: "ongoing",
    status: "active",
    dueAt: null,
    directFocusSeconds: 0,
    aggregateFocusSeconds: 0,
    sortKey: "a",
  },
  {
    id: "child",
    parentId: "root",
    title: "子条目",
    description: null,
    completionMode: "completable",
    status: "active",
    dueAt: null,
    directFocusSeconds: 0,
    aggregateFocusSeconds: 0,
    sortKey: "b",
  },
];

const session: FocusSession = {
  id: "focus-1",
  startedAt: "2026-06-26T10:00:00.000Z",
  endedAt: "2026-06-26T11:00:00.000Z",
  captureMode: "manual",
  note: null,
  outcome: null,
  segments: [],
};

const segment = (
  id: string,
  startedAt: string,
  endedAt: string
): FocusSegment => ({ id, startedAt, endedAt, entryId: null, note: null });

describe("mock domain invariants", () => {
  it("rejects moving an entry below itself or one of its descendants", () => {
    expect(() => assertEntryMoveIsValid(entries, "root", "root")).toThrow(MockDomainError);
    expect(() => assertEntryMoveIsValid(entries, "root", "child")).toThrow(/ENTRY_MOVE_INVALID/);
    expect(() => assertEntryMoveIsValid(entries, "child", null)).not.toThrow();
  });

  it("does not allow a continuous entry to complete", () => {
    expect(() => assertEntryStatusIsValid(entries[0], "completed")).toThrow(
      /ENTRY_STATUS_INVALID/
    );
    expect(() => assertEntryStatusIsValid(entries[1], "completed")).not.toThrow();
  });

  it("rejects overlapping focus sessions but accepts adjacent ones", () => {
    expect(() =>
      assertNoFocusOverlap([session], "2026-06-26T10:30:00.000Z", "2026-06-26T11:30:00.000Z")
    ).toThrow(/FOCUS_OVERLAP/);
    expect(() =>
      assertNoFocusOverlap([session], "2026-06-26T11:00:00.000Z", "2026-06-26T12:00:00.000Z")
    ).not.toThrow();
  });

  it("requires ordered, gap-free segments that exactly partition a session", () => {
    expect(() =>
      assertSegmentsPartitionSession(session, [
        segment("a", "2026-06-26T10:00:00.000Z", "2026-06-26T10:20:00.000Z"),
        segment("b", "2026-06-26T10:20:00.000Z", "2026-06-26T11:00:00.000Z"),
      ])
    ).not.toThrow();

    expect(() =>
      assertSegmentsPartitionSession(session, [
        segment("a", "2026-06-26T10:00:00.000Z", "2026-06-26T10:20:00.000Z"),
        segment("b", "2026-06-26T10:25:00.000Z", "2026-06-26T11:00:00.000Z"),
      ])
    ).toThrow(/SEGMENTS_INVALID_PARTITION/);
  });
});
