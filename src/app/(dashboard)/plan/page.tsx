"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { type DataSnapshot, useData } from "@/context/MockContext";
import { SafeMarkdown } from "@/components/common/SafeMarkdown";
import { EntryCreateDialog } from "@/components/entries/EntryCreateDialog";
import { Entry, WeekPlan } from "@/lib/domain/types";
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
    className={`relative group/action inline-flex h-7 w-7 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 ${className}`}
  >
    {children}
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-full z-40 mt-1.5 hidden whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1.5 text-[11px] font-normal text-white shadow-lg group-hover/action:block group-focus-visible/action:block dark:bg-zinc-700"
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
      <div key={entry.id} className="space-y-1.5">
        <div
          className={`group grid gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${
            entry.status === "completed"
              ? "border-zinc-200 bg-zinc-50/70 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40"
              : entry.status === "archived"
              ? "border-dashed border-zinc-300 bg-zinc-100/70 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/20"
              : "border-zinc-200 bg-white shadow-2xs hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          }`}
          style={{ marginInlineStart: `${depth * 16}px` }}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(entry.id)}
                  aria-label={isExpanded ? "折叠子节点" : "展开子节点"}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-zinc-200"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}

              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  entry.completionMode === "ongoing" ? "bg-blue-500" : "bg-emerald-500"
                }`}
                title={entry.completionMode === "ongoing" ? "持续型条目" : "可完成型条目"}
                aria-hidden="true"
              />

              <Link
                href={`/entries/${entry.id}`}
                className="min-w-0 truncate font-medium text-zinc-900 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-100 dark:hover:text-blue-400"
              >
                {entry.title}
              </Link>

              {entry.dueAt && (
                <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
                  截止 {entry.dueAt.slice(5, 10)}
                </span>
              )}

              {isInWeekPlan && (
                <span className="flex shrink-0 items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>本周</span>
                  {weekItem?.source === "rollover" && <span className="text-[9px] opacity-75">(结转)</span>}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 md:pl-7">
              <span className="font-mono tabular-nums">
                直 {directHours}h / 聚 {aggregateHours}h
              </span>
              {entry.aggregateFocusSeconds > entry.directFocusSeconds && (
                <span>含后代 {childrenHours}h</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-start gap-2 md:justify-end">
            <div className="relative group/time shrink-0">
              {entry.completionMode === "completable" && (
                <button
                  type="button"
                  aria-label={`查看 ${entry.title} 投入时长明细`}
                  title="查看投入时长明细"
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-mono tabular-nums text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-purple-400"
                >
                  <Clock className="h-3.5 w-3.5 text-zinc-400 group-hover/time:text-purple-500" aria-hidden="true" />
                  <span>{aggregateHours}h</span>
                </button>
              )}

              <div className="absolute right-0 bottom-full mb-2 hidden w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-xs text-zinc-100 shadow-xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none group-hover/time:block group-focus-within/time:block dark:bg-zinc-800">
                <div className="flex items-center justify-between border-b border-zinc-700/60 pb-1 text-[11px] font-semibold text-zinc-300">
                  <span>投入时长明细</span>
                  <Clock className="h-3 w-3 text-purple-400" aria-hidden="true" />
                </div>
                <div className="space-y-1 pt-1 text-[11px] font-mono tabular-nums">
                  <div className="flex justify-between text-zinc-300">
                    <span>直接投入:</span>
                    <span className="font-medium">{directHours}h</span>
                  </div>
                  <div className="flex justify-between font-semibold text-purple-300">
                    <span>聚合投入:</span>
                    <span>{aggregateHours}h</span>
                  </div>
                </div>
                {entry.aggregateFocusSeconds > entry.directFocusSeconds && (
                  <div className="border-t border-zinc-700/60 pt-1 text-[10px] text-zinc-400">
                    含后代子节点: {childrenHours}h
                  </div>
                )}
              </div>
            </div>

            <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-50 p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
              {isInWeekPlan ? (
                <ActionButton
                  onClick={() => void mutate(() => api.removeFromWeekPlan(entry.id, selectedWeek), {
                    backgroundRefresh: true,
                    update: mergeWeekPlan,
                  })}
                  label="从本周计划移出"
                  className="text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 focus-visible:ring-amber-500"
                >
                  <CalendarMinus className="h-3.5 w-3.5" aria-hidden="true" />
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
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
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
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              </ActionButton>

              <ActionButton
                onClick={() => void handleDeleteEntry(entry)}
                label="删除条目"
                className="text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:ring-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </ActionButton>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1 tree-line ml-2 pl-3">
            {children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-pretty">计划与条目树</h1>
          <p className="mt-1 text-xs text-zinc-500">
            按层级组织待办与长期方向，设定本周重点。
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
          <Calendar className="h-4 w-4 shrink-0 text-purple-500" aria-hidden="true" />
          <span className="font-medium text-zinc-500">本周计划：</span>
          <span className="min-w-0 truncate font-mono font-medium text-zinc-800 dark:text-zinc-200">
            {weekPlan.weekStart || "加载中"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)]">
        <section className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-pretty">
                  <Tag className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  <span>条目结构 ({matchingEntries.length} / {entries.length} 个节点)</span>
                </h2>
                <p className="mt-1 text-[11px] text-zinc-500">
                  层级通过缩进和连接线表达，常用操作贴在条目右侧。
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" /> 持续型
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> 可完成型
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4">
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
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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

              <div className="space-y-1">
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
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-pretty text-purple-600 dark:text-purple-400">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>该周计划项 ({weekPlan.items.length})</span>
              </h2>
              <span className="text-[10px] font-mono text-zinc-400">
                周起始：{weekPlan.weekStart}
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              {weekPlan.items.map((item) => {
                const ent = entries.find((e) => e.id === item.entryId);
                if (!ent) return null;
                return (
                  <div
                    key={item.entryId}
                    className="flex items-start justify-between gap-2 rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2 text-xs dark:border-purple-900/50 dark:bg-purple-950/20"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/entries/${ent.id}`}
                        className="block truncate font-medium text-zinc-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-zinc-100"
                      >
                        {ent.title}
                      </Link>
                      <span className="mt-0.5 block text-[10px] text-purple-600 dark:text-purple-400">
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
                      <CalendarMinus className="h-3.5 w-3.5" aria-hidden="true" />
                    </ActionButton>
                  </div>
                );
              })}
            </div>
          </section>

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
        </aside>
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
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <h3 className="font-semibold text-xs flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <FileText className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
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
            rows={5}
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            aria-label="周备忘 Markdown 内容"
            className="w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
          />
          <p className="text-[10px] text-zinc-400">
            支持 Markdown：标题、列表、**加粗**、*斜体*、`代码` 与链接。
          </p>
        </div>
      ) : (
        <SafeMarkdown
          content={displayedNote}
          fallback="点击编辑，记录本周想法与 Markdown 批注…"
          className="space-y-2 rounded-lg border border-zinc-200/60 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-400"
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
