# PRD 首版验收审计

> 审计日期：2026-07-24
> 验收状态：首版验收已闭环
> 范围：`feat/persistent-api-frontend-integration` 的持久化首版，不含已明确延期的天气配置与名句预抓取。

## 验收结论

账号、条目、周计划、专注、日历、ICS、统计、离线名句与当前账号 JSON 导出均已形成真实 API 或 SQLite 服务闭环。本轮新增数据库备份/恢复演练，使 PRD 中“可在同版本空实例恢复并核对”的数据管理要求具备命令与自动化证据。

天气不属于首版：它需要实例位置配置和额外设置页面能力。首页保留不阻塞的不可用状态；不得将 mock 天气场景误认为持久化首版的产品承诺。

## 已验收能力

| PRD 区域 | 状态 | 证据 |
|---|---|---|
| 注册模式、密码与登录会话 | 已验收 | `src/lib/persistence/sqlite-service.test.ts`、`src/lib/api/http.test.ts`、`e2e/persistent-api.spec.ts` |
| 可选昵称、邮箱格式与清空 | 已验收 | `src/lib/application/contract.test.ts`、`e2e/persistent-api.spec.ts` |
| 条目树、状态、周结转与隔离 | 已验收 | `src/lib/persistence/sqlite-service.test.ts` |
| 单活动计时、补录、拆分、未关联与历史保留 | 已验收 | `src/lib/persistence/sqlite-service.test.ts`、`e2e/persistent-api.spec.ts` |
| 双轨周历、日程编辑与 ICS 单向导入 | 已验收 | `src/lib/persistence/sqlite-service.test.ts`、`src/lib/schedule/*.test.ts`、`e2e/persistent-api.spec.ts` |
| 跨日统计、树聚合与未关联时长 | 已验收 | `src/lib/persistence/sqlite-service.test.ts` |
| 首页的今日数据、当前专注、待办、截止项、上海日期和离线名句 | 已验收 | `src/lib/persistence/sqlite-service.ts`、`src/app/(dashboard)/page.tsx`、`src/lib/ambient/quotations.test.ts` |
| 当前账号 JSON 导出与跨账号隔离 | 已验收 | `src/lib/persistence/sqlite-service.test.ts`、`e2e/persistent-api.spec.ts` |
| SQLite 一致性备份、校验与空实例恢复 | 已验收 | `scripts/lib/sqlite-snapshot.mjs`、`src/lib/db/sqlite-snapshot.test.ts` |

## 明确延期

| 能力 | 决定 | 再进入范围的前提 |
|---|---|---|
| 真实天气与缓存 | 首版不配置 | 明确实例或用户级位置模型、设置页配置、上游服务和缓存策略 |
| 名句预抓取 | 独立委托 | 完成古诗文网等来源的许可评估、候选抓取、人工审核和数据包发布流程 |
| Better Auth、FullCalendar | 不替换当前实现 | 当前认证与双轨周历不再满足需求时再单独评估 |

## 仍需人工演练

每次发布前，运维者应按 [SQLite 备份与恢复](../OPERATIONS.md) 在独立目录完成一次 `备份 -> 校验 -> 空实例恢复 -> 登录抽查`。自动化 round-trip 测试保证工具行为，人工演练验证实际部署卷、密钥和文件权限。
