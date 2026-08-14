import { readdir, rm } from "node:fs/promises";
import path from "node:path";

export const E2E_ARTIFACT_RETENTION_MS = 24 * 60 * 60 * 1_000;

const DIST_DIRECTORY_PATTERN = /^\.next-e2e-(\d+)-(\d+)$/;
const DATABASE_FILE_PATTERN = /^playwright-e2e-(\d+)-(\d+)\.db(?:-(?:wal|shm))?$/;

const processIsAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
};

const artifactFromEntry = (directory, name, pattern, recursive) => {
  const match = name.match(pattern);
  if (!match) return null;

  return {
    filename: path.join(directory, name),
    pid: Number(match[2]),
    startedAt: Number(match[1]),
    recursive,
  };
};

const entriesOrEmpty = async (directory) => {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

export const cleanupStaleE2eArtifacts = async ({
  root,
  dataDirectory,
  now = Date.now(),
  isProcessAlive = processIsAlive,
}) => {
  const [rootEntries, dataEntries] = await Promise.all([
    entriesOrEmpty(root),
    entriesOrEmpty(dataDirectory),
  ]);
  const artifacts = [
    ...rootEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => artifactFromEntry(root, entry.name, DIST_DIRECTORY_PATTERN, true)),
    ...dataEntries
      .filter((entry) => entry.isFile())
      .map((entry) => artifactFromEntry(dataDirectory, entry.name, DATABASE_FILE_PATTERN, false)),
  ].filter((artifact) => artifact !== null);

  const staleArtifacts = artifacts.filter(
    (artifact) =>
      now - artifact.startedAt > E2E_ARTIFACT_RETENTION_MS &&
      !isProcessAlive(artifact.pid),
  );

  await Promise.all(
    staleArtifacts.map(async (artifact) => {
      try {
        await rm(artifact.filename, { force: true, recursive: artifact.recursive });
      } catch (error) {
        console.warn(`无法清理 E2E 临时文件 ${artifact.filename}`, error);
      }
    }),
  );

  return staleArtifacts.map((artifact) => artifact.filename);
};
