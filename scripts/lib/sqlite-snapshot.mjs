import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const migrationTable = "__app_migrations";
const migrationDirectory = path.resolve("drizzle");

const requireExistingDatabase = (filename, label) => {
  if (!fs.existsSync(filename)) {
    throw new Error(`${label}不存在：${filename}`);
  }
};

const ensureDistinctFiles = (source, destination) => {
  if (path.resolve(source) === path.resolve(destination)) {
    throw new Error("源数据库与目标数据库不能是同一个文件");
  }
};

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const expectedMigrations = () =>
  fs.readdirSync(migrationDirectory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

export const databaseFilenameFromUrl = (databaseUrl = process.env.DATABASE_URL) => {
  const value = databaseUrl || "file:./data/personal-dashboard.db";
  if (!value.startsWith("file:")) {
    throw new Error("DATABASE_URL 必须使用 file: 路径");
  }
  const filename = value.slice("file:".length);
  if (!filename || filename === ":memory:") {
    throw new Error("备份与恢复不能使用内存数据库");
  }
  return path.resolve(filename);
};

export const defaultBackupFilename = (databaseFilename) => {
  const base = path.basename(databaseFilename, path.extname(databaseFilename));
  return path.resolve("backups", `${base}-${timestamp()}.db`);
};

export const verifyDatabase = (filename) => {
  const resolved = path.resolve(filename);
  requireExistingDatabase(resolved, "数据库文件");
  const sqlite = new Database(resolved, { readonly: true, fileMustExist: true });
  try {
    const integrity = sqlite.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") {
      throw new Error(`SQLite 完整性校验失败：${integrity}`);
    }
    const foreignKeyViolations = sqlite.pragma("foreign_key_check");
    if (foreignKeyViolations.length > 0) {
      throw new Error(`SQLite 外键校验失败：${foreignKeyViolations.length} 项`);
    }
    const migrations = sqlite
      .prepare(`SELECT name FROM ${migrationTable} ORDER BY name`)
      .all()
      .map((row) => row.name);
    const expected = expectedMigrations();
    if (migrations.join("\n") !== expected.join("\n")) {
      throw new Error("迁移版本与当前应用不一致；请使用相同版本的应用进行恢复或升级");
    }
    return { filename: resolved, integrity, migrations, expectedMigrations: expected };
  } finally {
    sqlite.close();
  }
};

export const backupDatabase = async (sourceFilename, destinationFilename) => {
  const source = path.resolve(sourceFilename);
  const destination = path.resolve(destinationFilename);
  requireExistingDatabase(source, "源数据库");
  ensureDistinctFiles(source, destination);
  if (fs.existsSync(destination)) {
    throw new Error(`备份目标已存在，不会覆盖：${destination}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const sqlite = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await sqlite.backup(destination);
  } finally {
    sqlite.close();
  }
  return verifyDatabase(destination);
};

export const restoreDatabase = async ({ sourceFilename, targetFilename, replace = false }) => {
  const source = path.resolve(sourceFilename);
  const target = path.resolve(targetFilename);
  requireExistingDatabase(source, "备份文件");
  ensureDistinctFiles(source, target);
  verifyDatabase(source);

  const targetExists = fs.existsSync(target);
  if (targetExists && !replace) {
    throw new Error("目标数据库已存在；只可恢复到空实例。确认替换请显式传入 --replace");
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const staging = path.join(path.dirname(target), `.${path.basename(target)}.restore-${process.pid}-${Date.now()}.db`);
  let preservedTarget = null;

  try {
    await backupDatabase(source, staging);
    if (targetExists) {
      const preRestore = path.join(
        path.dirname(target),
        `${path.basename(target, path.extname(target))}.pre-restore-${timestamp()}.db`
      );
      await backupDatabase(target, preRestore);
      preservedTarget = `${target}.replaced-${timestamp()}`;
      fs.renameSync(target, preservedTarget);
    }
    fs.renameSync(staging, target);
    fs.rmSync(`${target}-wal`, { force: true });
    fs.rmSync(`${target}-shm`, { force: true });
    return { ...verifyDatabase(target), replaced: targetExists, preservedTarget };
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { force: true });
    if (preservedTarget && !fs.existsSync(target)) fs.renameSync(preservedTarget, target);
    throw error;
  }
};
