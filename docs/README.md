# 文档索引

> 文档同步状态：2026-07-24。首版实现、前端样例校准和验收审计已闭环。

## 默认阅读

新 Agent 默认只读以下文件：

1. [当前状态](CURRENT_STATE.md)：已完成能力、延期项、重要代码入口和维护风险。
2. [仓库根 README](../README.md)：项目简介、本地命令和文档入口。
3. [Agent 工作约定](../AGENTS.md)：阅读顺序、边界和验证要求。

## 按任务阅读

| 任务 | 文档 |
|---|---|
| 产品语义、范围、不变量 | [产品需求](product/PRD.md) |
| UI/UX、视觉、交互契约 | [设计契约](../DESIGN.md) |
| 架构、API、数据库、部署约束 | [技术设计](architecture/TECHNICAL_DESIGN.md) |
| 测试范围和验收证据 | [薄测策略](testing/TEST_STRATEGY.md)、[PRD 首版验收审计](testing/PRD_ACCEPTANCE_AUDIT.md) |
| 本地运行和部署 | [项目初始化与本地运行](SETUP.md) |
| SQLite 备份、校验、恢复 | [SQLite 备份与恢复](OPERATIONS.md) |
| ICS 导入决策 | [ADR 0001：ICS 导入解析器](architecture/adr/0001-ics-import-parser.md) |
| 季节名句数据 | [季节名句数据包](content/QUOTATION_DATA_PACK.md) |

## 归档材料

- [前端样例任务书](archive/FRONTEND_MOCK_BRIEF.md)：已完成的历史校准基线。默认不读；只有追溯样例设计来源时阅读。

## 需求来源

- [访谈执行规格](../.omx/specs/deep-interview-personal-dashboard.md)
- [访谈摘要](../.omx/interviews/personal-dashboard-20260720T083155Z.md)

## 冲突处理

发生冲突时按以下顺序处理：

1. 用户最新明确决定；
2. 代码与最新测试证明的真实行为；
3. [当前状态](CURRENT_STATE.md)；
4. [PRD](product/PRD.md) 中的产品语义；
5. [DESIGN.md](../DESIGN.md) 中的交互与视觉约束；
6. [技术设计](architecture/TECHNICAL_DESIGN.md) 中的实现约束；
7. 归档材料和探索性产物。

文档与代码不一致时，不要直接相信旧文档；先核实实现，再更新对应文档。
