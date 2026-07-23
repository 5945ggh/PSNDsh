"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { type DataSnapshot, useData } from "@/context/MockContext";
import { SafeMarkdown } from "@/components/common/SafeMarkdown";
import { EntryCreateDialog } from "@/components/entries/EntryCreateDialog";
import { Entry, WeekPlan } from "@/types/mock";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  CheckCircle2,
  CalendarPlus,
  CalendarMinus,
  Sparkles,
  FileText,
  Tag,
  Calendar,
  Clock,
  Search,
  Trash2,
} from "lucide-react";

type EntryFilter = "all" | "unfinished" | "completed" | "archived";

const ActionButton: React.FC<{
  label: string;
  ariaLabel?: string;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, ariaLabel = label, className, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    title={label}
    className={`relative group/action p-1 rounded focus-visible:outline-none focus-visible:ring-2 ${className}`}
  >
    {children}
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-full z-40 mt-2 hidden whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1.5 text-[11px] font-normal text-white shadow-lg group-hover/action:block group-focus-visible/action:block dark:bg-zinc-700"
    >
      {label}
    </span>
  </button>
);

export default function PlanPage() {
  const { api, data, mutate } = useData();
  const entries = data.entries;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(["entry_ics2", "entry_ostep", "entry_lab4", "entry_ai_ethics", "entry_other", "entry_github"])
  );
  const weekPlan = data.currentWeekPlan ?? { weekStart: "", note: "", items: [] };
  const selectedWeek = weekPlan.weekStart || undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const mergeEntry = (snapshot: DataSnapshot, entry: Entry): DataSnapshot => ({
    ...snapshot,
    entries: snapshot.entries.some((item) => item.id === entry.id)
      ? snapshot.entries.map((item) => item.id === entry.id ? entry : item)
      : [...snapshot.entries, entry],
  });
  const mergeWeekPlan = (snapshot: DataSnapshot, nextWeekPlan: WeekPlan): DataSnapshot => ({
    ...snapshot,
    currentWeekPlan: nextWeekPlan,
  });
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const matchingEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      const matchesFilter =
        entryFilter === "all" ||
        (entryFilter === "unfinished" && (entry.status === "active" || entry.status === "paused")) ||
        (entryFilter === "completed" && entry.status === "completed") ||
        (entryFilter === "archived" && entry.status === "archived");
      const searchableText = `${entry.title} ${entry.description ?? ""}`.toLocaleLowerCase();
      return matchesFilter && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [entries, entryFilter, searchQuery]);

  const visibleEntryIds = useMemo(() => {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const visible = new Set<string>();
    matchingEntries.forEach((entry) => {
      let current: Entry | undefined = entry;
      while (current) {
        if (visible.has(current.id)) break;
        visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    });
    return visible;
  }, [entries, matchingEntries]);

  const rootEntries = entries.filter((e) => e.parentId === null && visibleEntryIds.has(e.id));
  const filterCounts = {
    all: entries.length,
    unfinished: entries.filter((entry) => entry.status === "active" || entry.status === "paused").length,
    completed: entries.filter((entry) => entry.status === "completed").length,
    archived: entries.filter((entry) => entry.status === "archived").length,
  };

  const handleDeleteEntry = async (entry: Entry) => {
    const confirmed = window.confirm(
      `确定删除“${entry.title}”及其所有子条目吗？\n\n删除后它们会从计划树和本周计划中隐藏，历史专注记录仍会保留。`
    );
    if (!confirmed) return;
    await mutate(() => api.deleteEntry(entry.id), {
      backgroundRefresh: true,
      update: (snapshot) => {
        const deletedIds = new Set<string>([entry.id]);
        let changed = true;
        while (changed) {
          changed = false;
          snapshot.entries.forEach((candidate) => {
            if (candidate.parentId && deletedIds.has(candidate.parentId) && !deletedIds.has(candidate.id)) {
              deletedIds.add(candidate.id);
              changed = true;
            }
          });
        }
        return {
          ...snapshot,
          entries: snapshot.entries.filter((candidate) => !deletedIds.has(candidate.id)),
          currentWeekPlan: snapshot.currentWeekPlan
            ? {
                ...snapshot.currentWeekPlan,
                items: snapshot.currentWeekPlan.items.filter((item) => !deletedIds.has(item.entryId)),
              }
            : snapshot.currentWeekPlan,
        };
      },
    });
  };

  const renderTreeNode = (entry: Entry, depth: number = 0) => {
    const children = entries.filter((e) => e.parentId === entry.id && visibleEntryIds.has(e.id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(entry.id);
    const isInWeekPlan = weekPlan.items.some((i) => i.entryId === entry.id);
    const weekItem = weekPlan.items.find((i) => i.entryId === entry.id);

    const directHours = (entry.directFocusSeconds / 3600).toFixed(1);
    const aggregateHours = (entry.aggregateFocusSeconds / 3600).toFixed(1);
    const childrenHours = ((entry.aggregateFocusSeconds - entry.directFocusSeconds) / 3600).toFixed(1);

    return (
      <div key={entry.id} className="space-y-1">
        <div
          className={`flex items-center justify-between p-2.5 rounded-lg border transition-all text-xs group ${
            entry.status === "completed"
              ? "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-65"
              : entry.status === "archived"
              ? "bg-zinc-100 dark:bg-zinc-900/20 border-dashed border-zinc-300 dark:border-zinc-800 opacity-50"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs"
          }`}
          style={{ marginLeft: `${depth * 18}px` }}
        >
          {/* Left info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(entry.id)}
                aria-label={isExpanded ? "折叠子节点" : "展开子节点"}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            ) : (
              <span className="w-4 h-4 inline-block shrink-0" aria-hidden="true" />
            )}

            {/* Mode badge */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                entry.completionMode === "ongoing"
                  ? "bg-blue-500"
                  : "bg-emerald-500"
              }`}
              title={
                entry.completionMode === "ongoing"
                  ? "持续型条目"
                  : "可完成型条目"
              }
              aria-hidden="true"
            />

            <Link
              href={`/entries/${entry.id}`}
              className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              {entry.title}
            </Link>

            {entry.dueAt && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 shrink-0">
                截止 {entry.dueAt.slice(5, 10)}
              </span>
            )}

            {isInWeekPlan && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>本周</span>
                {weekItem?.source === "rollover" && (
                  <span className="text-[9px] opacity-75">(结转)</span>
                )}
              </span>
            )}
          </div>

          {/* Right Metrics Popover & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Popover Hover Trigger for Time Breakdown */}
            <div className="relative group/time">
              {entry.completionMode === "completable" && <button
                type="button"
                aria-label={`查看 ${entry.title} 投入时长明细`}
                title="查看投入时长明细"
                className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <Clock className="w-3.5 h-3.5 text-zinc-400 group-hover/time:text-purple-500" aria-hidden="true" />
                <span>{aggregateHours}h</span>
              </button>}

              {/* Floating Popover on Hover / Focus */}
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover/time:block group-focus-within/time:block z-30 w-44 p-2.5 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                <div className="font-semibold text-[11px] text-zinc-300 border-b border-zinc-700/60 pb-1 flex items-center justify-between">
                  <span>投入时长明细</span>
                  <Clock className="w-3 h-3 text-purple-400" aria-hidden="true" />
                </div>
                <div className="space-y-1 text-[11px] font-mono tabular-nums">
                  <div className="flex justify-between text-zinc-300">
                    <span>直接投入:</span>
                    <span className="font-medium">{directHours}h</span>
                  </div>
                  <div className="flex justify-between text-purple-300 font-semibold">
                    <span>聚合投入:</span>
                    <span>{aggregateHours}h</span>
                  </div>
                </div>
                {entry.aggregateFocusSeconds > entry.directFocusSeconds && (
                  <div className="text-[10px] text-zinc-400 border-t border-zinc-700/60 pt-1">
                    含后代子节点: {childrenHours}h
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
              {isInWeekPlan ? (
                <ActionButton
                  onClick={() => void mutate(() => api.removeFromWeekPlan(entry.id, selectedWeek), {
                    backgroundRefresh: true,
                    update: mergeWeekPlan,
                  })}
                  label="从本周计划移出"
                  className="text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 focus-visible:ring-amber-500"
                >
                  <CalendarMinus className="w-3.5 h-3.5" aria-hidden="true" />
                </ActionButton>
              ) : (
                <ActionButton
                  onClick={() => void mutate(() => api.addToWeekPlan(entry.id, selectedWeek), {
                    backgroundRefresh: true,
                    update: mergeWeekPlan,
                  })}
                  label="加入本周计划"
                  className="text-zinc-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 focus-visible:ring-purple-500"
                >
                  <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                </ActionButton>
              )}

              <ActionButton
                onClick={() =>
                  void mutate(() => api.updateEntry(entry.id, {
                    status:
                      entry.status === "completed" ? "active" : "completed",
                  }), {
                    backgroundRefresh: true,
                    update: mergeEntry,
                  })
                }
                label={entry.status === "completed" ? "标记为未完成" : "标记为已完成"}
                className={`focus-visible:ring-emerald-500 ${
                  entry.status === "completed"
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
                    : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              </ActionButton>

              <ActionButton
                onClick={() =>
                  void mutate(() => api.addEntry({
                    parentId: entry.id,
                    title: `新子条目 - ${entry.title}`,
                    description: null,
                    completionMode: "completable",
                    dueAt: null,
                  }), {
                    backgroundRefresh: true,
                    update: mergeEntry,
                  })
                }
                label="添加子条目"
                className="text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 focus-visible:ring-blue-500"
              >
                <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              </ActionButton>

              <ActionButton
                onClick={() => void handleDeleteEntry(entry)}
                label="删除条目"
                className="text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:ring-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Children Subtree */}
        {hasChildren && isExpanded && (
          <div className="space-y-1 tree-line ml-3 pl-2">
            {children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-pretty">计划与条目树</h1>
          <p className="text-xs text-zinc-500 mt-1">
            按层级组织待办与长期方向，设定本周重点。
          </p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
          <Calendar className="w-4 h-4 text-purple-500 shrink-0 ml-1" aria-hidden="true" />
          <span className="text-zinc-500 font-medium">本周计划：</span>
          <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{weekPlan.weekStart || "加载中"}</span>
        </div>
      </div>

      {/* Main Two-Column Layout (Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Global Entries Tree (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2 text-pretty">
                <Tag className="w-4 h-4 text-blue-500" aria-hidden="true" />
                <span>条目结构 ({matchingEntries.length} / {entries.length} 个节点)</span>
              </h2>

              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" /> 持续型
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" /> 可完成型
                </span>
              </div>
            </div>

            {/* Search and creation controls stay separate so the tree remains visible while creating. */}
            <div className="flex flex-col gap-2 text-xs sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">搜索条目标题或描述</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索条目标题或描述…"
                aria-label="搜索条目标题或描述"
                className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
              />
              </label>
              <div className="flex gap-2">
                <label className="min-w-0 flex-1 sm:flex-none">
                  <span className="sr-only">筛选条目</span>
                  <select
                    value={entryFilter}
                    onChange={(e) => setEntryFilter(e.target.value as EntryFilter)}
                    aria-label="筛选条目"
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 sm:w-auto"
                  >
                    <option value="all">全部 ({filterCounts.all})</option>
                    <option value="unfinished">未完成 ({filterCounts.unfinished})</option>
                    <option value="completed">已完成 ({filterCounts.completed})</option>
                    <option value="archived">已归档 ({filterCounts.archived})</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  aria-label="新建顶层条目"
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-zinc-900 px-3.5 py-2 font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>新建条目</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
              <span>
                {searchQuery.trim() || entryFilter !== "all"
                  ? `匹配 ${matchingEntries.length} 个条目，已保留必要的父级路径`
                  : "按标题或描述搜索，也可以按状态筛选。"}
              </span>
              {(searchQuery || entryFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setEntryFilter("all");
                  }}
                  className="shrink-0 font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  清除筛选
                </button>
              )}
            </div>

            {/* Render Tree */}
            <div className="space-y-1.5 pt-1">
              {entries.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-400">
                  尚未创建任何条目，请点击“新建条目”添加首个条目。
                </p>
              ) : rootEntries.length > 0 ? (
                rootEntries.map((root) => renderTreeNode(root, 0))
              ) : (
                <div className="py-8 text-center text-xs text-zinc-400">
                  <p>没有符合当前搜索或筛选条件的条目。</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setEntryFilter("all");
                    }}
                    className="mt-2 font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    显示全部条目
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Week Plan & Markdown Note (1 col) */}
        <div className="space-y-5">
          {/* Week Items Box */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>该周计划项 ({weekPlan.items.length})</span>
              </h2>
              <span className="text-[10px] font-mono text-zinc-400">
                周起始：{weekPlan.weekStart}
              </span>
            </div>

            <div className="space-y-2">
              {weekPlan.items.map((item) => {
                const ent = entries.find((e) => e.id === item.entryId);
                if (!ent) return null;
                return (
                  <div
                    key={item.entryId}
                    className="p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2">
                      <Link
                        href={`/entries/${ent.id}`}
                        className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline truncate block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded"
                      >
                        {ent.title}
                      </Link>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400">
                        {item.source === "rollover" ? "上周自动结转" : "手动加入"}
                      </span>
                    </div>

                    <ActionButton
                      onClick={() => void mutate(() => api.removeFromWeekPlan(ent.id, selectedWeek), {
                        backgroundRefresh: true,
                        update: mergeWeekPlan,
                      })}
                      label="从本周计划移出"
                      ariaLabel="从该周移出"
                      className="shrink-0 text-zinc-400 hover:bg-red-50 hover:text-red-500 focus-visible:ring-red-500 dark:hover:bg-red-950/40"
                    >
                      <CalendarMinus className="w-3.5 h-3.5" aria-hidden="true" />
                    </ActionButton>
                  </div>
                );
              })}
            </div>
          </div>

          <WeekNoteCard
            key={weekPlan.weekStart}
            weekPlan={weekPlan}
            onSave={async (note) => {
              await mutate(() => api.updateWeekPlanNote(note, selectedWeek), {
                backgroundRefresh: true,
                update: mergeWeekPlan,
              });
            }}
          />
        </div>
      </div>

      <EntryCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="新建顶层条目"
        description="创建后仍会留在当前计划树中，方便继续整理。"
      />
    </div>
  );
}

const WeekNoteCard: React.FC<{
  weekPlan: WeekPlan;
  onSave: (note: string) => Promise<void>;
}> = ({ weekPlan, onSave }) => {
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [noteContent, setNoteContent] = useState(weekPlan.note);
  const [displayedNote, setDisplayedNote] = useState(weekPlan.note);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleToggleEdit = async () => {
    if (!isNoteEditing) {
      setNoteContent(displayedNote);
      setSaveError(null);
      setIsNoteEditing(true);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    const previousNote = displayedNote;
    setDisplayedNote(noteContent);
    try {
      await onSave(noteContent);
      setIsNoteEditing(false);
    } catch (error) {
      setDisplayedNote(previousNote);
      setSaveError(error instanceof Error ? error.message : "保存批注失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
        <h3 className="font-semibold text-xs flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <FileText className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
          <span>周备忘与批注</span>
        </h3>
        <button
          onClick={() => { void handleToggleEdit(); }}
          disabled={isSaving}
          className="text-blue-600 dark:text-blue-400 text-[11px] hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? "保存中…" : isNoteEditing ? "保存批注" : "编辑批注"}
        </button>
      </div>

      {isNoteEditing ? (
        <div className="space-y-2">
          <textarea
            rows={6}
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            aria-label="周备忘 Markdown 内容"
            className="w-full p-2.5 text-xs font-mono border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <p className="text-[10px] text-zinc-400">
            支持 Markdown：标题、列表、**加粗**、*斜体*、`代码` 与链接。
          </p>
        </div>
      ) : (
        <SafeMarkdown
          content={displayedNote}
          fallback="点击编辑，记录本周想法与 Markdown 批注…"
          className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800"
        />
      )}

      {saveError && (
        <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
};
