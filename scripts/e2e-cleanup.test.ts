import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupStaleE2eArtifacts,
  E2E_ARTIFACT_RETENTION_MS,
} from "./e2e-cleanup.mjs";

const temporaryDirectories: string[] = [];

const temporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "personal-dashboard-e2e-cleanup-"));
  temporaryDirectories.push(directory);
  return directory;
};

const exists = async (filename: string) => {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("cleanupStaleE2eArtifacts", () => {
  it("removes old E2E output and database sidecars while preserving unrelated files", async () => {
    const root = await temporaryDirectory();
    const dataDirectory = path.join(root, "data");
    await mkdir(dataDirectory);

    const now = 1_800_000_000_000;
    const oldRunId = `${now - E2E_ARTIFACT_RETENTION_MS - 1_000}-12345`;
    const freshRunId = `${now - E2E_ARTIFACT_RETENTION_MS + 1_000}-23456`;

    const oldDistDirectory = path.join(root, `.next-e2e-${oldRunId}`);
    const freshDistDirectory = path.join(root, `.next-e2e-${freshRunId}`);
    await mkdir(oldDistDirectory);
    await mkdir(freshDistDirectory);

    const oldDatabase = path.join(dataDirectory, `playwright-e2e-${oldRunId}.db`);
    const oldWal = `${oldDatabase}-wal`;
    const oldShm = `${oldDatabase}-shm`;
    const freshDatabase = path.join(dataDirectory, `playwright-e2e-${freshRunId}.db`);
    const productionDatabase = path.join(dataDirectory, "personal-dashboard.db");
    const unrelatedFile = path.join(dataDirectory, "playwright-e2e-not-a-run.db");
    await Promise.all([
      writeFile(oldDatabase, "old"),
      writeFile(oldWal, "old"),
      writeFile(oldShm, "old"),
      writeFile(freshDatabase, "fresh"),
      writeFile(productionDatabase, "production"),
      writeFile(unrelatedFile, "unrelated"),
    ]);

    await cleanupStaleE2eArtifacts({
      root,
      dataDirectory,
      now,
      isProcessAlive: () => false,
    });

    await expect(exists(oldDistDirectory)).resolves.toBe(false);
    await expect(exists(oldDatabase)).resolves.toBe(false);
    await expect(exists(oldWal)).resolves.toBe(false);
    await expect(exists(oldShm)).resolves.toBe(false);
    await expect(exists(freshDistDirectory)).resolves.toBe(true);
    await expect(exists(freshDatabase)).resolves.toBe(true);
    await expect(exists(productionDatabase)).resolves.toBe(true);
    await expect(exists(unrelatedFile)).resolves.toBe(true);
  });

  it("keeps artifacts for an old run whose PID is still alive", async () => {
    const root = await temporaryDirectory();
    const dataDirectory = path.join(root, "data");
    await mkdir(dataDirectory);

    const now = 1_800_000_000_000;
    const activePid = 54321;
    const activeRunId = `${now - E2E_ARTIFACT_RETENTION_MS - 1_000}-${activePid}`;
    const activeDistDirectory = path.join(root, `.next-e2e-${activeRunId}`);
    const activeDatabase = path.join(dataDirectory, `playwright-e2e-${activeRunId}.db`);
    await mkdir(activeDistDirectory);
    await writeFile(activeDatabase, "active");

    await cleanupStaleE2eArtifacts({
      root,
      dataDirectory,
      now,
      isProcessAlive: (pid) => pid === activePid,
    });

    await expect(exists(activeDistDirectory)).resolves.toBe(true);
    await expect(exists(activeDatabase)).resolves.toBe(true);
  });
});
