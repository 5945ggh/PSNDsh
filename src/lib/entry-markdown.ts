import type { Entry, EntryCompletionMode, EntryStatus } from "@/lib/domain/types";

const statusLabels: Record<EntryStatus, string> = {
  active: "活跃",
  paused: "暂停",
  completed: "已完成",
  archived: "已归档",
};

const completionModeLabels: Record<EntryCompletionMode, string> = {
  completable: "可完成型",
  ongoing: "持续型",
};

const normalizeHeading = (value: string) => value.replace(/[\r\n]+/g, " ").trim() || "未命名条目";

const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(2)} 小时`;

export const getEntryMarkdownFilename = (title: string) => {
  const safeTitle = title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  return `${safeTitle || "entry"}.md`;
};

export const buildEntryMarkdown = (entry: Entry, entries: Entry[]) => {
  const childrenByParentId = new Map<string, Entry[]>();
  for (const candidate of entries) {
    if (!candidate.parentId) continue;
    const children = childrenByParentId.get(candidate.parentId) ?? [];
    children.push(candidate);
    childrenByParentId.set(candidate.parentId, children);
  }

  const lines: string[] = [];
  const visited = new Set<string>();

  const appendEntry = (current: Entry, depth: number) => {
    if (visited.has(current.id)) return;
    visited.add(current.id);

    lines.push(`${"#".repeat(depth + 1)} ${normalizeHeading(current.title)}`, "");
    lines.push(
      `- 状态：${statusLabels[current.status]}`,
      `- 完成模式：${completionModeLabels[current.completionMode]}`,
      ...(current.dueAt ? [`- 截止日期：${current.dueAt.slice(0, 10)}`] : []),
      `- 直接投入：${formatHours(current.directFocusSeconds)}`,
      `- 聚合投入：${formatHours(current.aggregateFocusSeconds)}`,
      "",
    );

    if (current.description?.trim()) {
      lines.push(current.description.trim(), "");
    }

    for (const child of childrenByParentId.get(current.id) ?? []) {
      appendEntry(child, depth + 1);
    }
  };

  appendEntry(entry, 0);
  return `${lines.join("\n").trim()}\n`;
};

export const buildEntriesMarkdown = (entries: Entry[]) => {
  if (entries.length === 0) return "";

  const entryIds = new Set(entries.map((entry) => entry.id));
  const roots = entries.filter((entry) => !entry.parentId || !entryIds.has(entry.parentId));
  return `${roots.map((root) => buildEntryMarkdown(root, entries).trim()).join("\n\n")}\n`;
};
