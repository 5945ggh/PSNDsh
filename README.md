# 个人面板

个人面板是一个本地优先的个人 Web 工具，用于管理每周计划、嵌套条目、日程、真实专注时间和回顾统计。首版面向个人或少量隔离账号部署，不包含协作、Agent、LLM 或外部日历持续同步。

## 当前状态

- Next.js + React + TypeScript 模块化单体。
- SQLite 持久化、本地 mock 适配器和同源 JSON API 已并行存在。
- 注册、登录、资料、条目、周计划、专注、日历、ICS 导入、统计、JSON 导出、数据库备份与恢复已有实现。
- 天气显示保留不可用/降级位置；季节名句来自随应用发布的本地内容包。

更完整的交接状态见 [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)。

## 本地运行

```bash
corepack pnpm install
corepack pnpm dev
```

常用验证：

```bash
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm test
corepack pnpm build
```

E2E：

```bash
corepack pnpm test:e2e
```

本机如果 Playwright 浏览器缓存版本不匹配，可按实际缓存路径设置 `PLAYWRIGHT_EXECUTABLE_PATH` 后再运行。

## 文档入口

默认只读：

1. [docs/README.md](docs/README.md)
2. [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)
3. [AGENTS.md](AGENTS.md)

按任务再读：

- 产品语义：[docs/product/PRD.md](docs/product/PRD.md)
- UI/UX：[DESIGN.md](DESIGN.md)
- 架构、API、数据库：[docs/architecture/TECHNICAL_DESIGN.md](docs/architecture/TECHNICAL_DESIGN.md)
- 测试策略：[docs/testing/TEST_STRATEGY.md](docs/testing/TEST_STRATEGY.md)
- 部署与恢复：[docs/SETUP.md](docs/SETUP.md)、[docs/OPERATIONS.md](docs/OPERATIONS.md)

归档材料不作为默认阅读上下文。
