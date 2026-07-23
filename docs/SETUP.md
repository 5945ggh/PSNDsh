# 项目初始化与本地运行

## 环境要求

- Node.js LTS（Next.js 当前脚手架要求 Node.js 20.9 或更高版本）
- Corepack

项目在 `package.json` 中固定了 `pnpm@11.2.2`。本机直接执行的 `pnpm` 可能来自其他全局安装（当前环境直接执行为 11.9.0，而 Corepack 解析项目版本为 11.2.2），因此项目命令统一通过 Corepack 调用：

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

浏览器访问 <http://localhost:3000>。常用校验命令：

```bash
corepack pnpm lint
corepack pnpm build
corepack pnpm db:backup
```

不要提交 `.env.local` 或其他真实环境文件；后端实现开始后，以根目录 `.env.example` 为模板创建本地配置。当前骨架不要求数据库或认证环境变量即可启动，表中变量是后续服务端实现的配置基线。

## 当前目录职责

```text
src/app/       Next.js App Router 页面、布局和全局样式
public/        静态资源
docs/          产品、架构、设计、测试与初始化文档
.env.example   服务端配置占位模板
```

当前实现已包含登录/注册、首页、计划、日历、统计和设置页面，以及可在持久化模式下运行的同源 JSON API、SQLite schema、迁移与应用服务。`NEXT_PUBLIC_DATA_TRANSPORT` 未设置时使用持久化 API；显式设为 `mock` 时保留前端样例场景切换能力。

当前持久化模式已覆盖账号资料、条目、周计划、专注、手工日程、日历、统计、人工审核的本地季节名句、当前账号的结构化 JSON 导出，以及 ICS 文件的预览确认导入。ICS 重复事件会在未来 180 天展开为具体日程；全天事件、无时区重复事件、天气、作品级名句预抓取和部署容器仍是后续批次。

数据库级备份、校验和恢复使用 `db:backup`、`db:verify`、`db:restore` 命令；恢复只能在停止应用后进行。完整步骤、敏感数据边界与恢复演练见 [SQLite 备份与恢复](OPERATIONS.md)。季节名句由 `content/quotations/` 下的 JSON 数据包提供，格式见 [季节名句数据包](content/QUOTATION_DATA_PACK.md)。

## 初始化范围

项目锁定了 Next.js、React、TypeScript、Tailwind CSS、ESLint、Radix primitives、Lucide、Zod、Drizzle ORM、SQLite 驱动和 `node-ical@0.26.1`，并生成 `pnpm-lock.yaml`。ICS 解析器只在 Node 服务端路由中使用；实现边界与受限重复展开策略见 [ADR 0001](architecture/adr/0001-ics-import-parser.md)。Better Auth、FullCalendar、天气与名句预抓取适配器仍按技术设计中的待验证项处理，尚未接入。
