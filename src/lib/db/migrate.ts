import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_TABLE = "__app_migrations";

export const applyMigrations = (
  sqlite: Database.Database,
  migrationsDirectory = path.join(process.cwd(), "drizzle")
) => {
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)`
  );
  const applied = new Set(
    sqlite
      .prepare(`SELECT name FROM ${MIGRATION_TABLE}`)
      .all()
      .map((row) => (row as { name: string }).name)
  );
  const migrations = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const name of migrations) {
    if (applied.has(name)) continue;
    const sql = fs.readFileSync(path.join(migrationsDirectory, name), "utf8");
    const apply = sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite
        .prepare(`INSERT INTO ${MIGRATION_TABLE} (name, applied_at) VALUES (?, ?)`)
        .run(name, new Date().toISOString());
    });
    apply();
  }
};
