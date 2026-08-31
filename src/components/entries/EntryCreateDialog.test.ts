import { describe, expect, it } from "vitest";
import type { DataSnapshot } from "@/context/MockContext";
import type { Entry } from "@/lib/domain/types";
import { mergeCreatedEntry } from "./EntryCreateDialog";

const createdEntry: Entry = {
  id: "entry-new",
  parentId: null,
  title: "新方向",
  description: null,
  completionMode: "ongoing",
  status: "active",
  dueAt: null,
  directFocusSeconds: 0,
  aggregateFocusSeconds: 0,
  sortKey: "z_new",
};

const snapshot = {
  entries: [],
  currentWeekPlan: null,
} as unknown as DataSnapshot;

describe("mergeCreatedEntry", () => {
  it("upserts the created entry when a background refresh reapplies the same result", () => {
    const once = mergeCreatedEntry(snapshot, { entry: createdEntry, weekPlan: null });
    const twice = mergeCreatedEntry(once, { entry: createdEntry, weekPlan: null });

    expect(twice.entries.filter((entry) => entry.id === createdEntry.id)).toHaveLength(1);
    expect(twice.entries).toEqual([createdEntry]);
  });
});
