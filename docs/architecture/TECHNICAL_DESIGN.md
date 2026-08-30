# 个人面板技术设计

> 状态：Active，持久化 API、SQLite 服务、ICS 导入和路由级数据加载已实施
>
> 日期：2026-07-24
>
> 产品基线：[PRD](../product/PRD.md)

## 1. 技术目标

- 单机内网部署简单，升级、备份和恢复可理解。
- 计划、专注、日程和统计的数据语义可靠。
- 活动计时、跨周结转、片段拆分和 ICS 导入在重试下保持幂等或可解释。
- 天气、名句预处理和外部文件解析与核心业务隔离。
- 首版保持模块化单体，不提前建设多服务或 Agent 架构。

## 2. 技术选型

| 领域 | 选择 |
|---|---|
| Web | Next.js、React、TypeScript |
| 样式与组件 | Tailwind CSS、Radix primitives、Lucide |
| 数据库 | SQLite，WAL 模式 |
| 数据访问 | Drizzle ORM + SQL migration |
| 输入校验 | Zod |
| ICS | `node-ical@0.26.1`，Node 服务端解析 |
| 单元与集成测试 | Vitest |
| 浏览器测试 | Playwright |
| 部署 | Docker 单容器 + SQLite 持久化卷 |

依赖必须服务于 PRD 语义；不得为了适配库而改变产品模型。

## 3. 架构边界

```text
Browser
  -> Next.js routes / route handlers
      -> application services
          -> domain policies
              -> repositories -> SQLite
          -> adapters
              -> ICS parser
              -> bundled quotation catalog
```

- React 组件不直接访问数据库或外部服务。
- Route handler 负责认证、输入解析和响应映射。
- Application service 组织事务和用例。
- Domain policy 负责纯计算，例如时间切分、树聚合和结转判断。
- Repository 负责持久化，不把 ORM 记录直接暴露给前端。
- 外部适配器通过明确接口返回内部 DTO，失败必须可降级。

## 4. 模块职责

| 模块 | 责任 |
|---|---|
| `auth` | 注册能力、账号密码、会话、对象归属 |
| `profile` | 昵称、可选邮箱和设置 |
| `entries` | 条目树、状态、截止日期、归档与移动 |
| `week-plans` | 周计划、周备注、纳入关系与幂等结转 |
| `focus` | 活动计时、补录、片段划分、重叠校验 |
| `schedule` | 手工日程、重复规则和 ICS 导入 |
| `calendar` | 按范围合并日程与专注的只读查询 |
| `statistics` | 时间边界切分、直接投入与递归聚合 |
| `dashboard` | 首页聚合查询，不拥有核心数据 |
| `ambient` | 本地名句内容包；天气暂为不可用状态 |
| `data-management` | JSON 导出、数据库备份、校验与恢复 |

## 5. 数据模型

所有主键使用稳定 ID。所有业务表带 `user_id` 或通过父对象关联到用户。时间戳以 UTC 或带偏移 ISO 时间存储；本地日期键必须明确其 `effectiveTimezone`。

主要关系：

```text
User
  +-- Entry (self-referencing tree)
  +-- WeekPlan -- WeekPlanEntry -- Entry
  +-- FocusSession -- FocusSegment -- optional Entry
  +-- ScheduleBlock
```

历史关系：

- 条目默认归档或软删除；专注历史不能被条目删除级联移除。
- 条目改名、移动或状态变化后，历史页面显示当前元数据。
- 首版不保存完整对象版本历史。

## 6. 领域不变量

- 一个条目只能属于同一用户的父条目，移动必须防止环。
- 完成或归档父节点不能静默修改后代状态。
- 每个用户最多一条活动中的 `focus_session`。
- 同一用户的有效专注会话不得互相重叠。
- 日程与专注允许重叠，不参与专注冲突校验。
- 专注片段必须无缝覆盖会话区间，未分配区间显式保存为未关联。
- `total = sum(all direct entry buckets) + unassigned`。
- 周计划结转必须幂等，数据库唯一约束阻止重复纳入。
- 所有业务查询和写入必须显式限定当前用户。

## 7. API 边界

首版使用同源 JSON API。响应以 `{ "data": ..., "meta": ... }` 为正常形态，以稳定错误码表达领域错误。

主要接口族：

| 接口族 | 代表能力 |
|---|---|
| `/api/v1/capabilities` | 匿名可读的注册能力 |
| `/api/auth/*` | 注册、登录、退出、会话 |
| `/api/v1/me` | 当前资料读取与修改 |
| `/api/v1/entries` | 条目树、创建、修改、移动、状态与归档 |
| `/api/v1/week-plans/:week` | 周计划读取、纳入、移除、排序、备注 |
| `/api/v1/focus/current` | 当前计时读取、开始与结束 |
| `/api/v1/focus/sessions` | 查询、补录、编辑、拆分 |
| `/api/v1/schedule-blocks` | 日程 CRUD 和手工重复规则 |
| `/api/v1/schedule-blocks/imports/*` | ICS 预览、确认、批次查询和删除 |
| `/api/v1/calendar` | 给定范围内的日程与专注联合只读数据 |
| `/api/v1/statistics` | 日、周、月和条目子树统计 |
| `/api/v1/dashboard` | 首页聚合 DTO |
| `/api/v1/export` | 当前账号结构化 JSON 导出 |
| `/api/v1/api-keys` | 已登录网页 session 下创建、列出与撤销快捷捕获 API key |
| `/api/v1/api-keys/:id` | 已登录网页 session 下再次查看某个 API key |
| `/api/v1/expenses/capture` | 仅接受 Bearer API key 的最小开销捕获；不使用 cookie session 或 CSRF 同源校验；`id` 可省略，服务端会生成 UUID |

快捷捕获 key 是独立于网页登录 session 的受限凭据。每个 key 由不含用户信息的公开定位符和高熵 secret 组成；服务端仅保存 secret 的 scrypt 哈希和由 `AUTH_SECRET` 派生密钥加密的副本。Bearer key 只被 `/api/v1/expenses/capture` 显式接受，不能代表网页 session 访问其他接口。`AUTH_SECRET` 轮换前必须先轮换已有 API key；当前实现未提供加密密钥环，因此旧 key 的加密副本在 secret 变更后不能再次查看。捕获请求提供 `id` 时按该 UUID 做幂等重试；省略或留空 `id` 时由服务端生成新 UUID，因此网络重试可能产生重复记录。

## 8. 前端数据加载

全局 Provider 只加载当前路由需要的资源，避免每次进入页面都拉取全量历史。

- 匿名登录/注册页只读取 capabilities。
- 首页读取 dashboard。
- 计划页读取当前周计划。
- 条目详情读取条目和必要专注历史。
- 统计页先读取周统计，日/月由页面按需请求。
- 设置页可读取需要展示的计数资源。
- 日历页使用 `/api/v1/calendar?from=&to=` 的范围查询，不依赖全局全量 `focusSessions` 或 `scheduleBlocks`。

新增页面或 Provider mutation 时，先更新 `src/context/data-load-plan.ts` 及其测试。

## 9. 外部输入与内容

### ICS

- 文件上限 1 MiB。
- 采用预览和确认两阶段；预览有有效期且只能由创建账号确认。
- 单次定时事件直接导入。
- 带 UTC 或 IANA `TZID` 的重复事件在未来 180 天窗口内展开。
- 未声明时区的重复事件按 `effectiveTimezone` 解释。
- 全天事件和无效事件在预览中明确过滤。
- 导入批次可整体删除；首版不回写外部日历。

详见 [ADR 0001](adr/0001-ics-import-parser.md)。

### 名句与天气

- 季节名句以版本化本地 JSON 内容包发布，运行时不请求上游。
- 当前先使用人工审核内容；预抓取脚本、许可复核和作品级来源补齐延期。
- 天气不属于首版；首页展示非阻塞不可用状态。

## 10. 导出、备份与恢复

- `/api/v1/export` 只导出当前账号非敏感业务数据，不包含密码哈希、会话、服务端密钥和外部缓存。
- SQLite 备份必须使用一致性快照或 SQLite backup API，不能在活跃写入时直接复制未知状态文件。
- 恢复以相同应用版本的空实例为默认目标；`--replace` 必须显式确认。
- `db:backup`、`db:verify`、`db:restore` 负责命令行灾备流程。
- 发布前应按 [运维文档](../OPERATIONS.md) 做一次人工恢复演练。

## 11. 部署配置

首版支持单应用容器加 SQLite 持久化卷。生产部署保持单实例；多实例前必须先迁移进程内限流状态。

| 变量 | 必需 | 默认 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | 是 | 无 | SQLite 文件路径 |
| `AUTH_SECRET` | 是 | 无 | 会话密钥 |
| `REGISTRATION_MODE` | 否 | `first-user` | 注册开放策略 |
| `APP_TIMEZONE` | 否 | `Asia/Shanghai` | `effectiveTimezone` |
| `PUBLIC_ORIGIN` | 生产需要 | 无 | 写请求同源校验和公开 origin |
| `PUBLIC_BASE_URL` | 兼容配置 | 无 | `PUBLIC_ORIGIN` 的旧名称兼容项 |

`.env.example` 只能放占位值，不得提交真实密钥。

## 12. 测试边界

重点覆盖会造成数据损坏或核心闭环失效的规则：

- 注册模式和跨账号隔离；
- 唯一活动计时器；
- 专注重叠和片段完整分区；
- 跨日、周、月边界切分；
- 条目树环和递归聚合；
- 周计划幂等结转；
- ICS 时区、重复事件、异常日期和确认导入；
- Provider 路由级资源加载。

详细范围见 [测试策略](../testing/TEST_STRATEGY.md)。

## 13. 延期技术决策

- Better Auth 替换当前认证实现：当前实现不再满足需求时再评估。
- FullCalendar 替换当前双轨周历：当前布局能力不足时再评估。
- 天气适配器：需先明确位置模型和设置入口。
- 名句预抓取：需先完成来源许可评估和内容包发布流程。
