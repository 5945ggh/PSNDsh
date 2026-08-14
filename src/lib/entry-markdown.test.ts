import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/domain/types";
import { buildEntriesMarkdown, buildEntryMarkdown, getEntryMarkdownFilename } from "./entry-markdown";

const makeEntry = (overrides: Partial<Entry>): Entry => ({
  id: "entry",
  parentId: null,
  title: "条目",
  description: null,
  completionMode: "completable",
  status: "active",
  dueAt: null,
  directFocusSeconds: 0,
  aggregateFocusSeconds: 0,
  sortKey: "a0",
  ...overrides,
});

describe("entry markdown export", () => {
  it("exports entry metadata, description, and nested descendants", () => {
    const root = makeEntry({
      id: "root",
      title: "准备考试",
      description: "整理复习计划",
      dueAt: "2026-08-01T15:59:59.000Z",
      directFocusSeconds: 3600,
      aggregateFocusSeconds: 5400,
    });
    const child = makeEntry({
      id: "child",
      parentId: "root",
      title: "复习第一章",
      description: "完成课后题",
      status: "completed",
      sortKey: "a1",
    });
    const grandchild = makeEntry({
      id: "grandchild",
      parentId: "child",
      title: "整理错题",
      sortKey: "a2",
    });

    expect(buildEntryMarkdown(root, [root, child, grandchild])).toBe(
      "# 准备考试\n\n- 状态：活跃\n- 完成模式：可完成型\n- 截止日期：2026-08-01\n- 直接投入：1.00 小时\n- 聚合投入：1.50 小时\n\n整理复习计划\n\n## 复习第一章\n\n- 状态：已完成\n- 完成模式：可完成型\n- 直接投入：0.00 小时\n- 聚合投入：0.00 小时\n\n完成课后题\n\n### 整理错题\n\n- 状态：活跃\n- 完成模式：可完成型\n- 直接投入：0.00 小时\n- 聚合投入：0.00 小时\n",
    );
  });

  it("sanitizes filenames without removing readable titles", () => {
    expect(getEntryMarkdownFilename('阅读 / 复盘: "设计"?')).toBe("阅读 - 复盘- -设计--.md");
    expect(getEntryMarkdownFilename("   ")).toBe("entry.md");
  });

  it("combines all root trees into one markdown document", () => {
    const firstRoot = makeEntry({ id: "first", title: "第一方向" });
    const firstChild = makeEntry({ id: "first-child", parentId: "first", title: "第一步" });
    const secondRoot = makeEntry({ id: "second", title: "第二方向" });

    expect(buildEntriesMarkdown([firstRoot, firstChild, secondRoot])).toBe(
      "# 第一方向\n\n- 状态：活跃\n- 完成模式：可完成型\n- 直接投入：0.00 小时\n- 聚合投入：0.00 小时\n\n## 第一步\n\n- 状态：活跃\n- 完成模式：可完成型\n- 直接投入：0.00 小时\n- 聚合投入：0.00 小时\n\n# 第二方向\n\n- 状态：活跃\n- 完成模式：可完成型\n- 直接投入：0.00 小时\n- 聚合投入：0.00 小时\n",
    );
  });
});
