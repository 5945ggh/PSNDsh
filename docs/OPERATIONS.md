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

## GitHub Actions 与无构建服务器部署

仓库包含三条 Actions 工作流：

- `CI` 在 Pull Request 和 `main` 推送上执行依赖安装、lint、TypeScript 检查、Vitest、生产构建，并验证 Dockerfile 可以构建。
- `Publish container image` 在 `main` 推送和 `v*.*.*` 标签上构建并发布镜像到 GHCR，镜像地址会统一转换为小写，例如 `ghcr.io/5945ggh/psndsh`。`main` 额外发布 `latest`，每次发布也会带不可变的提交 SHA 标签。
- `Deploy production image` 只能手动触发，使用 `production` Environment 的审批和 Secrets，通过密钥 SSH 到服务器后同步 Compose/部署脚本，再拉取指定镜像。它不会在每次合并后自动改线上。

首次使用前，在 GitHub 仓库的 `Settings` 中完成以下设置：

1. `Actions > General > Workflow permissions` 至少允许工作流读取仓库内容；发布工作流通过 `GITHUB_TOKEN` 写入 Packages。
2. `Packages` 中将对应 GHCR 包设置为私有或公开。私有包需要在服务器保存一个只读的 GitHub fine-grained PAT，权限仅需 `read:packages`。
3. 创建 `production` Environment；如果希望上线前人工确认，在该 Environment 的 Required reviewers 中加入自己。
4. 为默认分支启用分支保护，要求 `CI / verify` 和 `CI / container` 通过后才能合并；发布和部署工作流不应作为合并前置条件。

在 `production` Environment 中添加以下 Secrets：

| Secret | 内容 |
|---|---|
| `DEPLOY_HOST` | 阿里云轻量服务器的稳定公网 IP 或部署用域名 |
| `DEPLOY_USER` | 服务器上的非 root 部署用户 |
| `DEPLOY_PATH` | `/srv/personal-dashboard`；该目录和其中的 `.env` 需预先存在，workflow 会创建/更新 `scripts/` 子目录 |
| `DEPLOY_SSH_KEY` | 本机用于连接服务器的私钥全文；对应公钥已写入服务器用户的 `authorized_keys` |
| `DEPLOY_KNOWN_HOSTS` | 在可信网络执行 `ssh-keyscan -H <服务器 IP 或域名>` 后人工核对得到的整行 host key，禁止在 workflow 中关闭 host key 校验 |

服务器不需要 Node.js、pnpm 或源码。首次初始化部署目录时，用服务器上的 `admin` 用户执行：

```bash
sudo mkdir -p /srv/personal-dashboard/scripts
sudo chown -R admin:admin /srv/personal-dashboard
```

然后创建一个仅服务器可读的 `/srv/personal-dashboard/.env`：

```dotenv
IMAGE=ghcr.io/OWNER/REPOSITORY:sha-<commit>
AUTH_SECRET=用 openssl rand -base64 32 生成的高熵值
PUBLIC_ORIGIN=https://dsh.shuifangboys.icu
APP_BIND_ADDRESS=127.0.0.1
APP_PORT=3001
REGISTRATION_MODE=first-user
APP_TIMEZONE=Asia/Shanghai
```

如果 GHCR 包为私有，先在服务器执行一次 `sudo docker login ghcr.io`，用户名使用 GitHub 用户名，密码使用只授予 `read:packages` 的 PAT。当前 `admin` 用户没有加入 `docker` 组，但有免密码 sudo，因此 workflow 和下面的手动命令会显式传入 `DOCKER_SUDO=1`；如果以后将部署用户加入 docker 组，可改为 `DOCKER_SUDO=0`。确保 DNS 的 A 记录 `dsh.shuifangboys.icu` 指向这台服务器，并让 Caddy 把 HTTPS 请求转发到 `127.0.0.1:3001`；公网安全组不必开放 3001 端口（只开放 SSH 和 HTTPS 所需端口）。

Caddy 配置可以使用以下站点块（证书由现有 Caddy 自动申请/续期）：

```text
dsh.shuifangboys.icu {
    reverse_proxy 127.0.0.1:3001
}
```

也可以在服务器手动执行同一部署流程：

```bash
cd /srv/personal-dashboard
chmod 600 .env
DOCKER_SUDO=1 IMAGE=ghcr.io/OWNER/REPOSITORY:sha-<commit> ./scripts/deploy-production.sh
```

通过 Actions 部署时，在 `Actions > Deploy production image > Run workflow` 中填写要发布的完整镜像引用，例如 `ghcr.io/5945ggh/psndsh:sha-xxxxxxxx`。升级推荐填写版本标签或提交 SHA，而不是长期使用 `latest`；回滚时填写上一个已验证的标签再运行即可。脚本先校验 Compose 配置，再执行 `pull` 和 `up --detach --no-build --wait`，确认健康检查在 120 秒内通过后才结束；不会删除 `personal-dashboard-data` 数据卷。任何升级或恢复操作前都应先完成数据库备份。

生产容器默认限制为 512 MiB 内存（预留 256 MiB、swap 上限 768 MiB）、0.75 CPU 和 128 个进程。若未来观察到长期内存或 CPU 压力，应先调整这些 Compose 限制并验证，再扩大云服务器规格。

当前自动部署只覆盖“镜像发布后通过 SSH 手动批准部署”。没有把阿里云控制台凭据、SSH 私钥或服务器地址写入仓库；后续如需合并即发布，可在保持 `production` Environment 审批和同一 Secrets 的前提下，将部署 workflow 的触发器扩展到 `workflow_run`。

### 注册策略

当前产品只提供 `first-user`、`open`、`closed` 三种环境变量策略，没有管理员账号管理页面或邀请链接。小范围邀请朋友时建议：首次启动使用 `first-user` 创建自己的账号；需要邀请时临时将 `.env` 中的 `REGISTRATION_MODE` 改为 `open` 并重新运行部署脚本；朋友完成注册后改回 `closed`，避免长期开放公网注册。切换策略会重启容器，但不会修改数据库卷。

## 发布前恢复演练记录

每次更换应用版本至少执行一次以下流程，并保留命令输出或运维记录：

1. 在运行实例上执行 `db:backup`，然后用 `db:verify` 校验备份。
2. 停止应用，恢复到全新的 `recovery-drill.db`，再次执行 `db:verify`。
3. 使用同一应用版本启动恢复实例，重新登录。
4. 抽查账号资料、条目树、本周计划、ICS 导入批次和专注记录。
5. 确认恢复实例健康后再替换正式数据卷；正式替换必须使用 `--replace`，并保留回退文件直到抽查完成。

恢复期间不要复制正在使用的 `.db`、`-wal` 或 `-shm` 文件，也不要让两个应用进程同时写入同一个 SQLite 文件。
