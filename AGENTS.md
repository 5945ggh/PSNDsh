# Agent 工作约定

本文件是交给新 Agent 的仓库本地入口。它只描述本项目的阅读顺序、边界和验证要求。

## 开始前

1. 先读 [docs/README.md](docs/README.md) 和 [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)。
2. 执行 `git status --short --branch`，确认当前分支和未提交改动。不得覆盖用户或其他 Agent 的未提交改动。
3. 按任务选择专项文档：
   - 产品语义：`docs/product/PRD.md`
   - UI/UX：`DESIGN.md`
   - 架构、API、数据库：`docs/architecture/TECHNICAL_DESIGN.md`
   - 测试：`docs/testing/TEST_STRATEGY.md`
   - 部署、备份、恢复：`docs/SETUP.md`、`docs/OPERATIONS.md`
   - ICS：`docs/architecture/adr/0001-ics-import-parser.md`
   - 名句数据包：`docs/content/QUOTATION_DATA_PACK.md`
4. 历史任务书和归档材料默认不读，除非任务要求追溯设计来源。

## 当前实现边界

- 领域类型入口是 `src/lib/domain/types.ts`。
- Mock 专属类型入口是 `src/lib/mock/types.ts`。
- `src/types/mock.ts` 只是旧路径兼容层，不要新增生产引用。
- Provider 使用 `src/context/data-load-plan.ts` 做路由级资源加载；改动全局数据加载时必须更新对应测试。
- 日历页使用范围化 `getCalendarPayload(from, to)`，不要恢复 Provider 级全量日历依赖。
- 统计、时间边界和 ICS 行为以 `effectiveTimezone` 为准，不依赖宿主机时区。

## 修改原则

- 文档描述现状；代码和最新测试证明现状。冲突时先核实，再更新文档。
- 不为未来 Agent、LLM、MCP 或多服务架构提前增加抽象。
- 安全、认证、密码、会话、时区和数据库恢复属于高风险边界，改动后必须有针对性验证。
- 新依赖需要明确用途、维护状态和替代方案；不要为小问题新增依赖。

## 验证要求

小改动至少运行：

```bash
corepack pnpm lint
corepack pnpm exec tsc --noEmit
```

涉及领域逻辑、Provider、API、持久化、时间、ICS 或统计时，再运行相关 Vitest：

```bash
corepack pnpm test
```

涉及用户主流程、登录态、日历、导入、统计或响应式页面时，运行：

```bash
corepack pnpm test:e2e
```

合并前应至少通过 lint、typecheck、相关测试和生产构建。

## 提交约定

提交标题描述修改意图，而不是罗列文件。正文按实际需要记录以下 Lore trailers：

```text
Constraint: 影响决策的外部约束
Rejected: 考虑但未采用的方案 | 原因
Confidence: low|medium|high
Scope-risk: narrow|moderate|broad
Directive: 后续修改者必须保留的边界
Tested: 已完成的验证
Not-tested: 已知未验证项
```

只填写能提供决策上下文的字段；不得虚构验证结果。
