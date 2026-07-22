import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ApplicationError } from "@/lib/application/error";
import { openDatabase } from "@/lib/db";
import { entries, users } from "@/lib/db/schema";
import { SqliteApplicationService } from "./sqlite-service";

const USER_A = "user-a";
const USER_B = "user-b";
const at = (value: string) => new Date(value);

const seedUser = (db: ReturnType<typeof openDatabase>["db"], id: string, username = id) => {
  db.insert(users).values({
    id,
    username,
    passwordHash: null,
    nickname: null,
    profileEmail: null,
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
  }).run();
};

describe("SqliteApplicationService", () => {
  let handle: ReturnType<typeof openDatabase>;
  let currentTime: Date;

  beforeEach(() => {
    handle = openDatabase(":memory:");
    currentTime = at("2026-06-26T12:00:00.000Z");
    seedUser(handle.db, USER_A);
    seedUser(handle.db, USER_B);
  });

  const service = (userId: string | null = USER_A) => new SqliteApplicationService(handle.db, {
    userId,
    clock: () => currentTime,
    effectiveTimezone: "Asia/Shanghai",
  });

  it("keeps entry trees user-owned and rejects self/descendant moves and ongoing completion", () => {
    const app = service();
    const root = app.addEntry({ parentId: null, title: "方向", description: null, completionMode: "ongoing", dueAt: null });
    const child = app.addEntry({ parentId: root.id, title: "任务", description: null, completionMode: "completable", dueAt: null });

    expect(() => app.moveEntry(root.id, root.id)).toThrow(/ENTRY_MOVE_INVALID/);
    expect(() => app.moveEntry(root.id, child.id)).toThrow(/ENTRY_MOVE_INVALID/);
    expect(() => app.updateEntry(root.id, { status: "completed" })).toThrow(/ENTRY_STATUS_INVALID/);
    expect(app.getEntryById(root.id)?.parentId).toBeNull();
  });

  it("rolls active entries into the next week once without copying the entry", () => {
    const app = service();
    const rollover = app.addEntry({ parentId: null, title: "继续事项", description: null, completionMode: "completable", dueAt: null });
    const completed = app.addEntry({ parentId: null, title: "已完成", description: null, completionMode: "completable", dueAt: null });
    const archived = app.addEntry({ parentId: null, title: "已归档", description: null, completionMode: "completable", dueAt: null });
    app.updateEntry(completed.id, { status: "completed" });
    app.updateEntry(archived.id, { status: "archived" });
    app.addToWeekPlan(rollover.id, "2026-06-22");
    app.addToWeekPlan(completed.id, "2026-06-22");
    app.addToWeekPlan(archived.id, "2026-06-22");

    const first = app.getWeekPlan("2026-06-29");
    const second = app.getWeekPlan("2026-06-29");
    expect(first.items).toEqual([{ entryId: rollover.id, source: "rollover", sortKey: expect.any(String) }]);
    expect(second.items).toEqual(first.items);
    expect(app.getEntries().filter((entry) => entry.id === rollover.id)).toHaveLength(1);
  });

  it("keeps focus facts isolated, permits schedule overlap, and splits cross-midnight time by local day", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "夜间工作", description: null, completionMode: "completable", dueAt: null });
    const session = app.addManualFocusSession({
      startedAt: "2026-06-25T23:30:00+08:00",
      endedAt: "2026-06-26T00:30:00+08:00",
      note: null,
      outcome: null,
      entryId: entry.id,
    });
    const schedule = app.addScheduleBlock({
      kind: "course",
      title: "同时发生的课程",
      startedAt: "2026-06-25T23:45:00+08:00",
      endedAt: "2026-06-26T00:15:00+08:00",
      location: null,
      colorKey: "blue",
      recurrence: null,
    });

    expect(schedule.startedAt).toContain("23:45");
    expect(session.segments).toHaveLength(1);
    const week = app.getStatisticsPayload("week");
    expect(week.daily.find((bucket) => bucket.date === "2026-06-25")?.seconds).toBe(1_800);
    expect(week.daily.find((bucket) => bucket.date === "2026-06-26")?.seconds).toBe(1_800);
    expect(week.totalSeconds).toBe(3_600);
    expect(week.unassignedSeconds).toBe(0);
  });

  it("requires gap-free focus partitions and preserves total duration after reassignment", () => {
    const app = service();
    const firstEntry = app.addEntry({ parentId: null, title: "第一项", description: null, completionMode: "completable", dueAt: null });
    const secondEntry = app.addEntry({ parentId: null, title: "第二项", description: null, completionMode: "completable", dueAt: null });
    currentTime = at("2026-06-26T10:00:00.000Z");
    const active = app.startFocusSession();
    currentTime = at("2026-06-26T11:00:00.000Z");
    expect(() => app.stopFocusSession(active.id, null, null, [
      { id: "a", startedAt: active.startedAt, endedAt: "2026-06-26T10:30:00.000Z", entryId: firstEntry.id, note: null },
      { id: "b", startedAt: "2026-06-26T10:35:00.000Z", endedAt: "2026-06-26T11:00:00.000Z", entryId: secondEntry.id, note: null },
    ])).toThrow(/SEGMENTS_INVALID_PARTITION/);
    expect(app.getActiveFocus()?.id).toBe(active.id);

    const stopped = app.stopFocusSession(active.id, null, null, [
      { id: "a", startedAt: active.startedAt, endedAt: "2026-06-26T10:30:00.000Z", entryId: firstEntry.id, note: null },
      { id: "b", startedAt: "2026-06-26T10:30:00.000Z", endedAt: "2026-06-26T11:00:00.000Z", entryId: secondEntry.id, note: null },
    ]);
    expect(stopped.segments.map((segment) => segment.entryId)).toEqual([firstEntry.id, secondEntry.id]);
    expect(stopped.segments.reduce((sum, segment) => sum + (Date.parse(segment.endedAt) - Date.parse(segment.startedAt)), 0)).toBe(3_600_000);
  });

  it("leaves a tombstone and historical segment explainable after entry deletion", () => {
    const app = service();
    const entry = app.addEntry({ parentId: null, title: "保留历史", description: null, completionMode: "completable", dueAt: null });
    app.addManualFocusSession({ startedAt: "2026-06-26T09:00:00.000Z", endedAt: "2026-06-26T09:30:00.000Z", note: null, outcome: null, entryId: entry.id });
    app.deleteEntry(entry.id);

    expect(app.getEntries().some((candidate) => candidate.id === entry.id)).toBe(false);
    expect(app.getFocusSessions()[0].segments[0].entryId).toBe(entry.id);
    const tombstone = handle.db.select().from(entries).where(eq(entries.id, entry.id)).get();
    expect(tombstone?.deletedAt).toEqual(expect.any(String));
    expect(tombstone?.title).toContain("[已删除]");
  });

  it("does not cross the user boundary", () => {
    const appA = service(USER_A);
    const appB = service(USER_B);
    const entry = appA.addEntry({ parentId: null, title: "只属于 A", description: null, completionMode: "completable", dueAt: null });
    expect(appB.getEntryById(entry.id)).toBeUndefined();
    expect(() => appB.updateEntry(entry.id, { title: "越权" })).toThrow(ApplicationError);
    expect(() => appB.addToWeekPlan(entry.id, "2026-06-22")).toThrow(/ENTRY_NOT_FOUND/);
  });

  it("stores a one-way password verifier and closes first-user registration after success", () => {
    const previousMode = process.env.REGISTRATION_MODE;
    process.env.REGISTRATION_MODE = "first-user";
    const empty = openDatabase(":memory:");
    try {
      const app = new SqliteApplicationService(empty.db, { userId: null, clock: () => currentTime });
      const registered = app.register({ username: "new-user", password: "password123", passwordConfirmation: "password123" });
      expect(registered.user?.username).toBe("new-user");
      const stored = empty.db.select().from(users).get();
      expect(stored?.passwordHash).toBeTruthy();
      expect(stored?.passwordHash).not.toBe("password123");
      expect(() => app.register({ username: "second", password: "password123", passwordConfirmation: "password123" })).toThrow(/REGISTRATION_CLOSED/);
      app.logout();
      expect(app.login({ username: "new-user", password: "password123" }).user?.id).toBe(stored?.id);
    } finally {
      if (previousMode === undefined) delete process.env.REGISTRATION_MODE;
      else process.env.REGISTRATION_MODE = previousMode;
    }
  });
});
