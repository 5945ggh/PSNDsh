import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runId = `${Date.now()}-${process.pid}`;
const databasePath = path.join(root, "data", `playwright-e2e-${runId}.db`);
const distDir = `.next-e2e-${runId}`;
const tsconfigPath = path.join(root, "tsconfig.json");
const port = process.env.PLAYWRIGHT_PORT || "3100";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const originalTsconfig = await readFile(tsconfigPath);

await mkdir(path.dirname(databasePath), { recursive: true });

const child = spawn(
  pnpm,
  ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", port],
  {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: `file:${databasePath}`,
      NEXT_DIST_DIR: distDir,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "playwright-test-secret",
      REGISTRATION_MODE: process.env.REGISTRATION_MODE ?? "open",
      APP_TIMEZONE: process.env.APP_TIMEZONE ?? "Asia/Shanghai",
      NEXT_PUBLIC_DATA_TRANSPORT: process.env.NEXT_PUBLIC_DATA_TRANSPORT ?? "persistent",
    },
    stdio: "inherit",
  },
);

let restoreInFlight = false;
const restoreTsconfig = async () => {
  if (restoreInFlight) return;
  restoreInFlight = true;
  try {
    const current = await readFile(tsconfigPath);
    if (!current.equals(originalTsconfig)) await writeFile(tsconfigPath, originalTsconfig);
  } catch {
    // The child may briefly replace the file while Next initializes its project.
  } finally {
    restoreInFlight = false;
  }
};
const restoreTimer = setInterval(() => void restoreTsconfig(), 250);

let cleaned = false;
const cleanup = async () => {
  if (cleaned) return;
  cleaned = true;
  clearInterval(restoreTimer);
  await Promise.all([
    rm(databasePath, { force: true }),
    rm(`${databasePath}-wal`, { force: true }),
    rm(`${databasePath}-shm`, { force: true }),
    rm(distDir, { recursive: true, force: true }),
    writeFile(tsconfigPath, originalTsconfig),
  ]);
};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
    void cleanup().then(() => process.exit(1));
  });
}

child.on("exit", async (code) => {
  await cleanup();
  process.exit(code ?? 1);
});

child.on("error", async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
