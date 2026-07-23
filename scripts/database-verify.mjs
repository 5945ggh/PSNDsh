import { verifyDatabase } from "./lib/sqlite-snapshot.mjs";

const filename = process.argv[2];
if (!filename) {
  console.error("用法：corepack pnpm db:verify <数据库文件>");
  process.exitCode = 1;
} else {
  try {
    const report = verifyDatabase(filename);
    console.log(`校验通过：${report.filename}`);
    console.log(`完整性：${report.integrity}；已应用迁移：${report.migrations.join(", ") || "无"}`);
  } catch (error) {
    console.error(error instanceof Error ? `校验失败：${error.message}` : "校验失败");
    process.exitCode = 1;
  }
}
