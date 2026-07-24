# 当前状态

> 同步日期：2026-07-24

本文给新 Agent 快速建立项目现状。长期产品语义仍以 [PRD](product/PRD.md) 为准，交互设计以 [DESIGN.md](../DESIGN.md) 为准。

## 已完成的首版能力

- 账号注册、登录、退出、会话恢复和资料编辑。
- `REGISTRATION_MODE=first-user|open|closed` 注册策略。
- 嵌套条目、完成模式、状态、截止时间、归档和树形管理。
- 周计划、周备注、条目纳入、移除和幂等结转。
- 实时专注、手动补录、重叠校验、片段拆分和未关联统计。
- 日历范围查询、手工日程、日程模板、ICS 预览确认导入和导入批次管理。
- 日、周、月统计，直接投入、聚合投入和未关联投入区分。
- 首页聚合、季节名句本地内容包、天气不可用降级状态。
- 当前账号 JSON 导出。
- SQLite 备份、校验、恢复命令和 Docker 单容器部署路径。

## 重要代码入口

| 领域 | 入口 |
|---|---|
| 页面 | `src/app/(dashboard)`、`src/app/(auth)` |
| API 路由 | `src/app/api` |
| 前端 API 客户端 | `src/lib/api/client.ts` |
| 领域类型 | `src/lib/domain/types.ts` |
| 持久化服务 | `src/lib/persistence/sqlite-service.ts` |
| 数据库 schema | `src/lib/db/schema.ts` |
| Mock 服务 | `src/lib/mock` |
| Provider 数据加载计划 | `src/context/data-load-plan.ts` |
| 全局数据 Provider | `src/context/MockContext.tsx` |
| 时间口径 | `src/lib/time/timezone.ts` |
| ICS 解析 | `src/lib/schedule/ics-import.ts` |
| 季节名句 | `src/lib/ambient/quotations.ts`、`content/quotations` |

## 当前架构判断

- 项目仍是模块化单体，不拆服务。
- SQLite 是首版持久化基础；通过备份/恢复流程解决个人部署灾备。
- API 与 mock 契约共用领域类型，但 Mock 场景类型已经从生产领域类型中分离。
- Provider 不再全局预加载所有数据，而是按路由加载必要资源；同一用户导航时保留已加载快照。
- 日历使用范围化接口，避免全量拉取专注和日程历史。

## 明确延期或非目标

- 邮件验证、找回密码、OAuth、双因素认证。
- 多用户协作、共享、角色权限和管理员后台。
- Agent、LLM、MCP、自动摘要、智能分类和自动生成计划。
- 外部日历持续同步或双向回写。
- Markdown 历史批量导入和双向同步。
- 完整对象版本历史、审计回放和历史树快照。
- 原生客户端。

## 已知维护点

- `src/types/mock.ts` 是旧路径兼容层；后续可在稳定期删除。
- 天气仍未进入首版真实配置；首页只要求非阻塞降级。
- 名句内容包当前以本地 JSON 为准；扩充内容时必须保留作者、作品、来源和版本字段。
- Playwright 在部分本机环境可能需要显式指定已有浏览器可执行文件。

## 交付前验证基线

```bash
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm test
corepack pnpm build
```

改动登录、日历、导入、统计、Provider 或主流程时增加：

```bash
corepack pnpm test:e2e
```
