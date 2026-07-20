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
```

不要提交 `.env.local` 或其他真实环境文件；后端实现开始后，以根目录 `.env.example` 为模板创建本地配置。当前骨架不要求数据库或认证环境变量即可启动，表中变量是后续服务端实现的配置基线。

## 当前目录职责

```text
src/app/       Next.js App Router 页面、布局和全局样式
public/        静态资源
docs/          产品、架构、设计、测试与初始化文档
.env.example   服务端配置占位模板
```

当前首页是脚手架占位页，业务页面和 mock 服务由后续前端样例任务实现。数据库 schema、迁移和领域服务尚未开始实现。

## 初始化范围

本次初始化锁定了 Next.js、React、TypeScript、Tailwind CSS、ESLint、Radix primitives、Lucide、Zod、Drizzle ORM 和 SQLite 驱动，并生成 `pnpm-lock.yaml`。Better Auth、FullCalendar、ICS 解析库和天气/名句适配器仍按技术设计中的待验证项处理，未在空骨架阶段预先绑定实现。
