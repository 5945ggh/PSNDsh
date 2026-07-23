import {
  backupDatabase,
  databaseFilenameFromUrl,
  defaultBackupFilename,
} from "./lib/sqlite-snapshot.mjs";
import path from "node:path";

const source = databaseFilenameFromUrl();
const destination = process.argv[2] ? path.resolve(process.argv[2]) : defaultBackupFilename(source);

try {
  const report = await backupDatabase(source, destination);
  console.log(`备份完成：${report.filename}`);
  console.log(`完整性：${report.integrity}；已应用迁移：${report.migrations.join(", ") || "无"}`);
} catch (error) {
  console.error(error instanceof Error ? `备份失败：${error.message}` : "备份失败");
  process.exitCode = 1;
}
