import { databaseFilenameFromUrl, restoreDatabase } from "./lib/sqlite-snapshot.mjs";

const argumentsAfterNode = process.argv.slice(2);
const sourceFilename = argumentsAfterNode.find((argument) => argument !== "--replace");
const replace = argumentsAfterNode.includes("--replace");

if (!sourceFilename) {
  console.error("用法：corepack pnpm db:restore <备份文件> [--replace]");
  process.exitCode = 1;
} else {
  try {
    const report = await restoreDatabase({
      sourceFilename,
      targetFilename: databaseFilenameFromUrl(),
      replace,
    });
    console.log(`恢复完成：${report.filename}`);
    console.log(`完整性：${report.integrity}；已应用迁移：${report.migrations.join(", ") || "无"}`);
    if (report.preservedTarget) console.log(`替换前数据库保留为：${report.preservedTarget}`);
  } catch (error) {
    console.error(error instanceof Error ? `恢复失败：${error.message}` : "恢复失败");
    process.exitCode = 1;
  }
}
