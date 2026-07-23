# 运维：SQLite 备份与恢复

## 范围与敏感性

数据库级备份是整个实例的一致性 SQLite 快照，包含账号资料、密码哈希、业务数据及数据库内元数据。它不是设置页的“当前账号 JSON 导出”，必须按敏感凭据处理：限制文件权限、加密保存，并且不要提交到仓库。

脚本只支持 `DATABASE_URL=file:...` 形式的 SQLite 文件。备份使用 SQLite backup API 生成单个 `.db` 文件；不要自行复制正在使用中的 `.db`、`-wal` 或 `-shm` 文件。

## 创建并校验备份

在线备份可在应用运行时执行：

```bash
DATABASE_URL=file:./data/personal-dashboard.db corepack pnpm db:backup
```

默认文件写入 `backups/`，该目录已经被 Git 忽略。也可以指定保存位置：

```bash
DATABASE_URL=file:./data/personal-dashboard.db \
  corepack pnpm db:backup ./secure-backups/personal-dashboard-2026-07-23.db

corepack pnpm db:verify ./secure-backups/personal-dashboard-2026-07-23.db
```

备份和校验都会执行 SQLite `integrity_check`、`foreign_key_check`，并确认 `__app_migrations` 与当前 `drizzle/*.sql` 迁移清单一致。

## 恢复演练

恢复是停机运维操作。先停止正在使用目标数据库的 Next.js 进程；当前应用会缓存数据库连接，不能在运行中热替换文件。

先恢复到一个不存在的空实例路径：

```bash
DATABASE_URL=file:./data/recovery-drill.db \
  corepack pnpm db:restore ./secure-backups/personal-dashboard-2026-07-23.db

DATABASE_URL=file:./data/recovery-drill.db \
  corepack pnpm db:verify ./data/recovery-drill.db
```

脚本将备份先复制到同目录的临时文件、校验后再写入目标。若目标数据库已经存在，默认拒绝覆盖；只有明确确认并已停止应用时才允许：

```bash
DATABASE_URL=file:./data/personal-dashboard.db \
  corepack pnpm db:restore ./secure-backups/personal-dashboard-2026-07-23.db --replace
```

`--replace` 会先在目标目录创建一致性的 `*.pre-restore-*.db` 备份，再替换目标文件，并保留被替换的原主数据库文件以便人工回退。恢复完成后应启动同一应用版本，登录并核对代表性账号、条目、周计划、日程和专注记录。

浏览器会话是签名 Cookie，不保存在 SQLite 中；数据库恢复不会让浏览器自动恢复旧会话，重新登录即可。

## Docker 发布检查

构建和启动单容器：

```bash
export AUTH_SECRET="$(openssl rand -base64 32)"
export PUBLIC_ORIGIN=https://dashboard.example.com
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 personal-dashboard
```

发布前确认容器状态为 `healthy`，数据卷名为 `personal-dashboard-data`，并且应用以非 root 用户运行。`AUTH_SECRET` 不写入仓库；SQLite 数据库和备份均包含密码哈希及业务数据，必须限制宿主机权限并加密保存。

## 发布前恢复演练记录

每次更换应用版本至少执行一次以下流程，并保留命令输出或运维记录：

1. 在运行实例上执行 `db:backup`，然后用 `db:verify` 校验备份。
2. 停止应用，恢复到全新的 `recovery-drill.db`，再次执行 `db:verify`。
3. 使用同一应用版本启动恢复实例，重新登录。
4. 抽查账号资料、条目树、本周计划、ICS 导入批次和专注记录。
5. 确认恢复实例健康后再替换正式数据卷；正式替换必须使用 `--replace`，并保留回退文件直到抽查完成。

恢复期间不要复制正在使用的 `.db`、`-wal` 或 `-shm` 文件，也不要让两个应用进程同时写入同一个 SQLite 文件。
