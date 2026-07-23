# 个人面板技术设计

> 状态：Active，持久化 API 与首批真实导入链路已经实施
> 日期：2026-07-22
> 产品基线：[PRD](../product/PRD.md)

## 1. 设计目标

技术方案需要优先保证：

- 单机内网部署简单，升级与备份可理解；
- 计划、专注和统计的数据语义可靠；
- 活动计时、跨周结转和片段拆分在异常或重试下不产生重复事实；
- 外部天气、名句内容预处理与 ICS 解析被隔离，不拖垮核心功能；
- 首版保持模块化单体，不为未来 Agent 或多服务架构提前付出复杂度；
- 未来可以在明确授权后增加只读 API 或 MCP，而不必重写核心数据模型。

## 2. 技术选型

| 领域 | 选择 | 说明 |
|---|---|---|
| 运行时 | Node.js LTS | 与全栈 TypeScript、容器部署兼容 |
| 包管理 | pnpm | 锁文件稳定，后续可自然扩展 workspace |
| Web 框架 | Next.js + React + TypeScript | 单仓库承载页面、服务端接口和后台任务 |
| UI 基础 | Tailwind CSS、Radix primitives、Lucide | 保留视觉自由度，同时复用可靠交互与图标 |
| 数据库 | SQLite，WAL 模式 | 适合个人或少量隔离账号，部署与灾备简单 |
| 数据访问 | Drizzle ORM + SQL migration | Schema 清晰，允许关键统计使用显式 SQL |
| 认证 | Better Auth 优先验证 | 只有满足用户名登录、邮箱可选和注册策略时才采用 |
| 输入校验 | Zod | 服务端、表单与 mock 契约共享 schema |
| 日期时间 | 成熟 IANA 时区库 | 数据库存 UTC，边界计算使用 `effectiveTimezone` |
| 周历 | FullCalendar `timeGrid` 优先验证 | 利用成熟事件布局；视觉分轨可能增加自定义渲染 |
| 图表 | Apache ECharts | 支持趋势、分布、下钻和响应式 |
| 天气 | Open-Meteo 适配器 | 免费、通常无需密钥，服务端缓存 |
| 名句内容 | 发布前预抓取脚本 + 版本化本地数据 | 运行时只读取本地内容包，不请求外部来源 |
| ICS | `node-ical@0.26.1` | Node 服务端异步解析；在受限窗口内展开时区、重复规则和异常日期，见 ADR 0001 |
| 单元与集成测试 | Vitest | 重点覆盖领域不变量和服务边界 |
| 浏览器测试 | Playwright | 只覆盖少量关键闭环和响应式烟测 |
| 部署 | Docker 单容器 + 持久化卷 | 应用、数据库和缓存数据有明确边界 |

依赖版本在项目初始化时根据当前稳定版锁定。不得为了使用某个库而改变 PRD 语义。

### 2.1 实施前依赖验证

在正式业务编码前完成四个短验证：

1. Better Auth 是否能原生表达“用户名和密码注册、资料邮箱可选、注册开放由服务端能力控制”。若必须伪造邮箱或破坏用户模型，则改用成熟密码哈希与会话组件组合，不采用伪邮箱方案。
2. SQLite 事务和部分唯一索引能否可靠保证每个用户只有一个活动计时器。
3. FullCalendar 免费能力能否在周视图中清楚区分日程与专注并处理重叠；不满足时只替换日历表现层。
4. ICS 库对 IANA 时区、周重复、学期有效范围和异常日期的解析结果是否可预测。

验证产物为简短 ADR 或文档更新，不演变成另一套原型。

## 3. 总体架构

采用模块化单体：

```text
Browser
  -> Next.js routes / server actions / route handlers
      -> application services
          -> domain policies
              -> Drizzle repositories -> SQLite
          -> external adapters
              -> weather
              -> ICS parser
      -> bundled quotation catalog
```

边界原则：

- React 组件不直接访问数据库或外部服务。
- Route handler 负责认证、输入解析和响应映射，不承载复杂领域规则。
- Application service 组织事务和用例。
- Domain policy 负责纯计算，例如时间切分、树聚合和结转判断。
- Repository 负责持久化，不把 ORM 记录直接暴露给前端。
- 外部适配器通过明确接口返回内部 DTO，失败必须可降级。季节名句由本地内容目录读取，不属于运行时外部适配器。

## 4. 模块划分

| 模块 | 责任 |
|---|---|
| `auth` | 注册能力、账号密码、会话、对象归属 |
| `profile` | 昵称、可选邮箱和设置 |
| `entries` | 统一条目树、状态、截止日期、归档与移动 |
| `week-plans` | 周计划、周备注、纳入关系与幂等结转 |
| `focus` | 活动计时、补录、片段划分、重叠校验 |
| `schedule` | 手工日程、课程、重复规则和 ICS 导入 |
| `calendar` | 按范围合并日程与专注的只读查询 |
| `statistics` | 时间边界切分、直接投入与递归聚合 |
| `dashboard` | 首页聚合查询，不拥有核心数据 |
| `ambient` | 天气缓存与降级、从本地内容包选择季节名句 |
| `data-management` | JSON 导出、数据库备份辅助与完整性检查 |

模块之间通过 service 或查询接口协作，不直接跨模块写表。

## 5. 数据模型

所有主键使用不可从业务含义推导的稳定 ID。时间戳以 UTC 或带偏移 ISO 时间存储；本地日期键需要显式记录其 `effectiveTimezone` 语义。

### 5.1 主要表

| 表 | 关键字段 | 说明 |
|---|---|---|
| `users` | `id`, `username`, `nickname`, `profile_email`, timestamps | 账号唯一；资料邮箱可空 |
| `sessions` | 由认证方案确定 | 不向业务接口暴露 |
| `entries` | `user_id`, `parent_id`, `title`, `description`, `completion_mode`, `status`, `due_at`, `sort_key`, deletion timestamps | 邻接表表达树 |
| `week_plans` | `user_id`, `week_start`, `note` | `(user_id, week_start)` 唯一 |
| `week_plan_entries` | `week_plan_id`, `entry_id`, `source`, `sort_key` | 防止同周重复纳入 |
| `focus_sessions` | `user_id`, `started_at`, `ended_at`, `capture_mode`, `note`, `outcome` | `ended_at IS NULL` 表示活动计时 |
| `focus_segments` | `session_id`, `started_at`, `ended_at`, `entry_id`, `note` | `entry_id` 为空表示未关联 |
| `schedule_blocks` | `user_id`, `kind`, `title`, time fields, recurrence fields, source | 课程、计划和其他日程 |
| `external_cache` | `namespace`, `cache_key`, payload, fetched/expiry timestamps | 天气缓存，不存业务私密数据 |

### 5.2 关系概览

```text
User
  +-- Entry (self-referencing tree)
  +-- WeekPlan -- WeekPlanEntry -- Entry
  +-- FocusSession -- FocusSegment -- optional Entry
  +-- ScheduleBlock
```

### 5.3 软删除与历史关系

- 条目默认归档，永久删除属于低频危险操作。
- 为了让专注历史保持可解释，永久删除采用 tombstone 或保留最小软删除记录，不把 `focus_segments.entry_id` 置为悬空外键。
- 条目改名、移动或状态变化后，历史页面显示当前元数据；首版不保存完整版本历史。
- 专注记录本身不能被条目的删除级联删除。

## 6. 领域不变量

### 6.1 条目树

- 一个条目只能属于同一用户的父条目。
- 条目不能成为自己的祖先，移动操作必须防止环。
- 完成或归档父节点不能静默修改后代状态。
- 聚合统计按当前树结构计算。

### 6.2 活动计时器

- 每个用户最多一条 `ended_at IS NULL` 的 `focus_session`。
- 开始计时在事务内检查并创建，依赖数据库唯一约束作为最终防线。
- 活动时长由持久化开始时间计算，不依赖浏览器计时器累计值。
- 服务重启或重新登录后，当前活动记录仍可查询。

### 6.3 专注区间

- 同一用户的有效专注会话不得互相重叠。
- 创建或修改会话时，在写事务内检查范围重叠。
- SQLite 不具备原生 exclusion constraint；使用串行写事务、重叠查询和针对性并发测试保证行为。
- 课程或计划与专注允许重叠，不参与专注冲突校验。

### 6.4 片段分区

一次已结束的专注会话必须被片段精确分区：

```text
union(segments) = [session.started_at, session.ended_at)
intersection(segment_i, segment_j) = empty
sum(segment.duration) = session.duration
```

- 结束计时时先创建覆盖整段的未关联片段，随后允许重新分配。
- 拆分提交使用“完整替换片段集合”的事务接口，服务端统一验证排序、边界、无缝覆盖和不重叠。
- 用户没有分配的区间显式保存为 `entry_id = null`，不能成为统计空洞。

### 6.5 统计

```text
aggregate(entry, range)
  = direct(entry, range)
  + sum(aggregate(child, range))
```

- `total = sum(all direct entry buckets) + unassigned`。
- 片段与查询区间按半开区间求交，跨日、周、月只计实际重叠时长。
- 移动条目或重新归属片段后，历史统计按当前解释重新计算。
- 统计查询不得把父级聚合值再次加入全局总计。

### 6.6 周结转

- 周键为 `effectiveTimezone` 中周一的本地日期。
- 访问当前周计划时，application service 幂等地确保本周存在并执行必要结转。
- 只结转上一周仍活跃、未完成、未归档且仍在上一周计划中的条目。
- 数据库唯一约束阻止并发或重试产生重复纳入关系。
- 历史周关系保留，不复制条目实体。

## 7. 注册与认证设计

### 7.1 环境变量策略

```dotenv
REGISTRATION_MODE=first-user
```

允许值：

| 值 | 服务端行为 |
|---|---|
| `first-user` | 用户表为空时开放；首次成功注册后关闭 |
| `open` | 持续允许注册独立账号 |
| `closed` | 始终拒绝注册，已有账号仍可登录 |

- 默认值为 `first-user`。
- 非法值导致应用启动失败，并输出不含秘密的配置错误。
- 修改后重启生效；数据库不存第二份开关。
- `GET /api/v1/capabilities` 只返回当前是否允许注册，不向匿名用户暴露账号数量。
- 前端隐藏入口只是体验优化，服务端是最终授权边界。

### 7.2 认证安全

- 不自研密码算法，使用维护活跃的 Argon2id 或认证库默认安全哈希。
- 会话 Cookie 使用 `HttpOnly`、合理 `SameSite`，HTTPS 部署时启用 `Secure`。
- 登录与注册采用服务端速率限制；错误信息不泄露账号是否存在。
- 所有业务查询和写入显式带当前 `user_id`。
- `open` 模式下用隔离测试验证账号不能读取、写入或导出他人数据。
- 资料邮箱与登录标识分离，邮箱为空是合法状态；不得生成伪邮箱迁就认证库。

## 8. API 与前端边界

首版使用同源 JSON API。路径仅作为设计基线，实施时可由框架约定调整，但 DTO 语义需要保持稳定。

### 8.1 响应约定

```json
{
  "data": {},
  "meta": {}
}
```

错误：

```json
{
  "error": {
    "code": "FOCUS_OVERLAP",
    "message": "该时段与已有专注记录重叠",
    "details": {}
  }
}
```

- 时间使用 ISO 8601；响应可同时提供用于展示的本地日期键。
- 枚举值稳定使用英文机器值，中文文案由前端管理。
- 列表接口返回稳定 ID，mock 不使用数组索引充当 ID。

### 8.2 主要接口族

| 接口族 | 代表能力 |
|---|---|
| `/api/v1/capabilities` | 匿名可读的注册可用性和实例能力 |
| `/api/auth/*` | 注册、登录、退出、会话；具体路径由认证适配器确定 |
| `/api/v1/me` | 当前资料读取与修改 |
| `/api/v1/entries` | 条目树、创建、修改、移动、状态与归档 |
| `/api/v1/week-plans/:week` | 周计划读取、纳入、移除、排序、备注 |
| `/api/v1/focus/current` | 当前计时读取、开始与结束 |
| `/api/v1/focus/sessions` | 查询、补录、编辑、拆分与删除策略 |
| `/api/v1/schedule-blocks` | 日程 CRUD 和手工重复规则 |
| `/api/v1/schedule-blocks/imports/ics/preview` | 解析不超过 1 MiB 的 ICS 文本，返回当前账号的短期预览 |
| `/api/v1/schedule-blocks/imports/ics/:importId/confirm` | 一次性消费当前账号预览并写入所选具体日程 |
| `/api/v1/calendar` | 给定范围内的日程与专注联合只读数据 |
| `/api/v1/statistics` | 日、周、月和条目子树统计 |
| `/api/v1/dashboard` | 首页聚合 DTO |
| `/api/v1/export` | 当前账号结构化 JSON 导出 |

详细 mock DTO 见 [前端样例任务书](../design/FRONTEND_MOCK_BRIEF.md)。前端样例可以调整页面内部 view model，但需要记录与领域 DTO 的映射。

## 9. 外部服务与后台工作

### 9.1 天气

- `WeatherProvider` 只接收实例地点和语言，不接收用户业务数据。
- 新鲜缓存 30 分钟；失败时可使用 24 小时内旧缓存。
- 上游请求超时 3 秒；无可用缓存时返回 `unavailable`，不抛出首页级错误。

### 9.2 名句

- 季节名句以版本化本地内容包随应用发布；内容包至少包含覆盖四季的最小数据集。当前先使用人工审核内容，作为不依赖爬取流程的离线基础。
- 发布前预抓取工具从批准的公开来源取得候选内容，优先评估古诗文网；每条保留作者、作品、来源地址和内容包版本，并执行格式、去重和季节覆盖校验。
- 人工内容包中的来源地址在预抓取流程上线前可记录为来源站点地址；上线时必须补齐作品级来源地址并完成复核。
- 预抓取工具不在应用容器的请求路径或后台刷新任务中运行。来源不可用或预抓取失败时，继续发布或保留上一版已校验内容包。
- 首页的 `QuotationCatalog` 只按日期和季节选择本地内容，网络不可用不影响该功能。

### 9.3 周结转与刷新

- 首版不依赖常驻 cron 才能保证正确性。
- 周结转采用访问时幂等执行；后台任务可作为优化，不能成为唯一正确性来源。
- 天气可在读取时触发受控刷新；同一缓存键使用互斥或 single-flight 防止请求风暴。名句内容只在发布或显式运维更新时变更。

## 10. JSON 导出、备份与恢复

### 10.1 JSON 导出

- 当前登录账号只能导出自己的非敏感资料和业务数据。
- 包含 schema version、导出时间、`effectiveTimezone` 和稳定 ID。
- 不包含密码哈希、会话、服务端密钥和外部缓存。
- 首版只承诺可读快照，不承诺直接导入。
- 当前实现通过 `GET /api/v1/export` 以下载响应提供此快照；导出内容以 `{ "data": ... }` 包装，便于与其余同源 API 保持一致。

### 10.2 数据库灾备

- SQLite 文件与必要 sidecar 必须通过一致性快照或 SQLite backup API 备份，不能在活跃写入时直接复制未知状态文件。
- 同版本空实例恢复后执行迁移版本检查、外键检查和代表性计数或查询。
- 数据库备份包含密码哈希和会话等敏感信息，部署文档必须提示权限和加密保存责任。

## 11. 部署与配置

### 11.1 容器形态

- 一个应用容器，一个持久化数据卷。
- 容器以非 root 用户运行。
- 健康检查只验证应用和数据库基本可用，不依赖天气上游或名句来源。
- 数据库、备份目录和可选导入临时文件使用明确路径。

### 11.2 首版环境变量

| 变量 | 必需 | 默认 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | 是 | 无 | SQLite 文件路径 |
| `AUTH_SECRET` | 是 | 无 | 会话或认证库密钥 |
| `REGISTRATION_MODE` | 否 | `first-user` | 注册开放策略 |
| `APP_TIMEZONE` | 否 | `Asia/Shanghai` | `effectiveTimezone` |
| `WEATHER_LATITUDE` | 首页天气需要 | 无 | 实例天气位置 |
| `WEATHER_LONGITUDE` | 首页天气需要 | 无 | 实例天气位置 |
| `PUBLIC_BASE_URL` | 生产部署需要 | 无 | Cookie 与回调基准地址 |

`.env.example` 只能放占位值，不得提交真实密钥。

## 12. 可观测性与错误处理

- 使用结构化日志记录请求 ID、错误码和必要上下文，不记录密码、Cookie、完整导出或用户自由文本。
- 领域错误使用稳定错误码，前端负责友好中文文案。
- 天气适配器失败记录来源、耗时和缓存命中状态，不升级为核心服务不可用；名句预抓取工具单独记录来源、内容包版本和校验结果。
- 数据迁移、备份和恢复命令输出明确阶段与最终校验结果。

## 13. 薄测边界

当前只要求覆盖会造成数据损坏或核心闭环失效的规则：注册模式、对象隔离、唯一计时器、专注重叠、片段完整分区、跨边界切分、树环、递归聚合和周结转幂等。详细范围见 [薄测策略](../testing/TEST_STRATEGY.md)。

不在前端样例阶段建设全面组件测试、全页面快照或大量边缘条件矩阵。设计确定后再按真实实现风险扩展。

## 14. 决策记录与待验证项

已确定：

- 模块化单体而非微服务；
- SQLite 而非独立数据库服务；
- 服务端持久化计时事实；
- `REGISTRATION_MODE` 只由环境变量控制；
- 访问时幂等周结转；
- 片段完整分区；
- JSON 导出与数据库灾备分离。
- `node-ical@0.26.1` 作为 Node 服务端 ICS 解析器；重复事件采用 180 天具体实例展开，异常日期与覆盖只在窗口内保留，详见 [ADR 0001](adr/0001-ics-import-parser.md)。

由实施者负责验证，不阻塞前端样例：

- [ ] Better Auth 对用户名和可选资料邮箱的真实兼容性；
- [ ] FullCalendar 对计划与专注双视觉语义的表现能力；
- [ ] 古诗文来源的可接受预抓取策略、许可风险与版本化内容包格式。
