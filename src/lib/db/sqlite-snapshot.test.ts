import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./index";
import { users } from "./schema";
import {
  backupDatabase,
  restoreDatabase,
  verifyDatabase,
} from "../../../scripts/lib/sqlite-snapshot.mjs";

const temporaryDirectories: string[] = [];

const temporaryDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-dashboard-snapshot-"));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite snapshots", () => {
  it("backs up, verifies, and restores a consistent database into an empty instance", async () => {
    const directory = temporaryDirectory();
    const source = path.join(directory, "source.db");
    const backup = path.join(directory, "backup.db");
    const restored = path.join(directory, "restored.db");
    const sourceHandle = openDatabase(source);
    sourceHandle.db.insert(users).values({
      id: "snapshot-user",
      username: "snapshot-user",
      passwordHash: "not-a-real-password",
      nickname: "恢复演练",
      profileEmail: null,
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z",
    }).run();
    sourceHandle.sqlite.close();

    const backupReport = await backupDatabase(source, backup);
    expect(backupReport.integrity).toBe("ok");
    expect(backupReport.migrations).toContain("0000_persistent_boundary.sql");
    expect(verifyDatabase(backup).integrity).toBe("ok");

    const restoredReport = await restoreDatabase({ sourceFilename: backup, targetFilename: restored });
    expect(restoredReport.replaced).toBe(false);
    const restoredHandle = openDatabase(restored);
    expect(restoredHandle.db.select().from(users).all()).toEqual([
      expect.objectContaining({ id: "snapshot-user", nickname: "恢复演练" }),
    ]);
    restoredHandle.sqlite.close();
  });

  it("refuses to replace a non-empty target unless replacement is explicit", async () => {
    const directory = temporaryDirectory();
    const source = path.join(directory, "source.db");
    const backup = path.join(directory, "backup.db");
    const target = path.join(directory, "target.db");
    openDatabase(source).sqlite.close();
    openDatabase(target).sqlite.close();
    await backupDatabase(source, backup);

    await expect(restoreDatabase({ sourceFilename: backup, targetFilename: target })).rejects.toThrow(/--replace/);
    const restored = await restoreDatabase({ sourceFilename: backup, targetFilename: target, replace: true });
    expect(restored.replaced).toBe(true);
    expect(restored.preservedTarget).toEqual(expect.stringContaining(".replaced-"));
  });
});
