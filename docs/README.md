# 文档索引

## 当前基线

- [产品需求](product/PRD.md)：产品目标、范围、领域语义和验收基线。
- [技术设计](architecture/TECHNICAL_DESIGN.md)：系统架构、数据模型、接口、部署与安全设计。
- [设计契约](../DESIGN.md)：UI/UX 与前端实现共同遵循的长期设计原则。
- [前端样例任务书](design/FRONTEND_MOCK_BRIEF.md)：交给前端样例 Agent 的页面、流程、mock 接口和交付要求。
- [薄测策略](testing/TEST_STRATEGY.md)：当前阶段只锁定高风险不变量和关键流程的测试范围。
- [项目初始化与本地运行](SETUP.md)：Node/Corepack/pnpm 约定、目录职责和当前初始化范围。

## 需求来源

- [访谈执行规格](../.omx/specs/deep-interview-personal-dashboard.md)
- [访谈摘要](../.omx/interviews/personal-dashboard-20260720T083155Z.md)

## 文档优先级

发生冲突时按以下顺序处理：

1. 用户最新明确决定；
2. `docs/product/PRD.md` 中的产品语义；
3. `DESIGN.md` 中的交互与视觉约束；
4. `docs/architecture/TECHNICAL_DESIGN.md` 中的实现设计；
5. 前端样例与其他探索性产物。

前端样例是重要参考，但不是产品语义或 API 的最终权威。样例暴露出更好的交互方案时，应先更新相应文档，再进入正式实现。
