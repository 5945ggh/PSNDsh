import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { applyMigrations } from "./migrate";
import { schema } from "./schema";

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

export type DatabaseHandle = {
  sqlite: Database.Database;
  db: AppDatabase;
};

export const openDatabase = (filename: string): DatabaseHandle => {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  applyMigrations(sqlite);
  return { sqlite, db: drizzle(sqlite, { schema }) };
};

let runtimeHandle: DatabaseHandle | null = null;

export const getRuntimeDatabase = (): AppDatabase => {
  if (!runtimeHandle) {
    const url = process.env.DATABASE_URL || "file:./data/personal-dashboard.db";
    const filename = url.startsWith("file:") ? url.slice("file:".length) : url;
    runtimeHandle = openDatabase(filename);
  }
  return runtimeHandle.db;
};
