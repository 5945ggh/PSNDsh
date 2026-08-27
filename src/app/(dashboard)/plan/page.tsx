"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { type DataSnapshot, useData } from "@/context/MockContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { SafeMarkdown } from "@/components/common/SafeMarkdown";
import { EntryCreateDialog } from "@/components/entries/EntryCreateDialog";
import { Entry, WeekPlan, WeekPlanItem, WeekPlanItemInput } from "@/lib/domain/types";
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
  Pencil,
  Download,
  AlertTriangle,
  Trash2,
  X,
  Play,
  Target,
  Minus,
} from "lucide-react";
import { buildEntriesMarkdown, buildEntryMarkdown, getEntryMarkdownFilename } from "@/lib/entry-markdown";
import { adjustPlannedFocusSeconds } from "@/lib/domain/week-plan";

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
  const { startFocus, activeFocus } = useFocusTimer();
  const entries = data.entries;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(["entry_ics2", "entry_ostep", "entry_lab4", "entry_ai_ethics", "entry_other", "entry_github"])
  );
  const weekPlan = data.currentWeekPlan ?? { weekStart: "", note: "", items: [] };
  const selectedWeek = weekPlan.weekStart || undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [entryToFocusId, setEntryToFocusId] = useState<string | null>(null);
  const [entryPendingDelete, setEntryPendingDelete] = useState<Entry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const entryLinkRefs = useRef(new Map<string, HTMLAnchorElement>());
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
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const focusItems = weekPlan.items.filter((item) => item.role === "focus");
  const plannedFocusSeconds = focusItems.reduce((sum, item) => sum + (item.plannedFocusSeconds ?? 0), 0);
  const weekEntryBreakdown = useMemo(
    () => new Map((data.statistics.week?.entryBreakdown ?? []).map((item) => [item.entryId, item])),
    [data.statistics.week],
  );
  const actualFocusSeconds = focusItems.reduce(
    (sum, item) => sum + (weekEntryBreakdown.get(item.entryId)?.aggregateSeconds ?? 0),
    0,
  );

  const updateWeekPlanItem = async (entryId: string, input: WeekPlanItemInput) => {
    await mutate(() => api.updateWeekPlanItem(entryId, input, selectedWeek), {
      backgroundRefresh: true,
      update: mergeWeekPlan,
    });
  };

  const addEntryToWeek = async (entry: Entry) => {
    await mutate(() => api.addToWeekPlan(entry.id, selectedWeek, {
      role: entry.completionMode === "ongoing" ? "focus" : "commitment",
      plannedFocusSeconds: null,
    }), {
      backgroundRefresh: true,
      update: mergeWeekPlan,
    });
  };
  useEffect(() => {
    if (!entryToFocusId) return;
    const target = entryLinkRefs.current.get(entryToFocusId);
    if (!target) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setEntryToFocusId(null);
  }, [entryToFocusId, entries, expandedIds, visibleEntryIds]);

  const filterCounts = {
    all: entries.length,
    unfinished: entries.filter((entry) => entry.status === "active" || entry.status === "paused").length,
    completed: entries.filter((entry) => entry.status === "completed").length,
    archived: entries.filter((entry) => entry.status === "archived").length,
  };

  const handleDeleteEntry = async () => {
    if (!entryPendingDelete || isDeleting) return;
    const entry = entryPendingDelete;
    setIsDeleting(true);
    try {
      await mutate(() => api.deleteEntry(entry.id), {
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
      setEntryPendingDelete(null);
    } catch {
      // DataProvider exposes the mutation error in the page shell.
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddChild = async (entry: Entry) => {
    try {
      const child = await mutate(() => api.addEntry({
        parentId: entry.id,
        title: `新子条目 - ${entry.title}`,
        description: null,
        completionMode: "completable",
        dueAt: null,
      }), {
        backgroundRefresh: true,
        update: mergeEntry,
      });

      setExpandedIds((current) => {
        const next = new Set(current);
        next.add(entry.id);
        return next;
      });
      setEntryToFocusId(child.id);
    } catch {
      // DataProvider exposes the mutation error in the page shell.
    }
  };

  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportEntry = (entry: Entry) => {
    downloadMarkdown(buildEntryMarkdown(entry, entries), getEntryMarkdownFilename(entry.title));
  };

  const handleExportAllEntries = () => {
    if (entries.length === 0) return;
    downloadMarkdown(buildEntriesMarkdown(entries), getEntryMarkdownFilename("所有条目"));
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
          className={`group grid gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${entry.status === "completed"
            ? "border-zinc-200 bg-zinc-50/70 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40"
            : entry.status === "archived"
              ? "border-dashed border-zinc-300 bg-zinc-100/70 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/20"
              : "border-zinc-200 bg-white shadow-2xs hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            } ${hasChildren ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (hasChildren) toggleExpand(entry.id);
          }}
          style={{ marginInlineStart: `${depth * 16}px` }}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleExpand(entry.id);
                  }}
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
                className={`h-2 w-2 shrink-0 rounded-full ${entry.completionMode === "ongoing" ? "bg-blue-500" : "bg-emerald-500"
                  }`}
                title={entry.completionMode === "ongoing" ? "持续型条目" : "可完成型条目"}
                aria-hidden="true"
              />

              <Link
                href={`/entries/${entry.id}`}
                onClick={(event) => event.stopPropagation()}
                ref={(node) => {
                  if (node) entryLinkRefs.current.set(entry.id, node);
                  else entryLinkRefs.current.delete(entry.id);
                }}
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
                  onClick={(event) => event.stopPropagation()}
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

            <div
              className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-50 p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40"
              onClick={(event) => event.stopPropagation()}
            >
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
                  onClick={() => void addEntryToWeek(entry)}
                  label={entry.completionMode === "ongoing" ? "加入本周关注" : "加入本周事项"}
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
                className={`focus-visible:ring-emerald-500 ${entry.status === "completed"
                  ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
                  : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              </ActionButton>

              <ActionButton
                onClick={() => void handleAddChild(entry)}
                label="添加子条目"
                className="text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 focus-visible:ring-blue-500"
              >
                <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              </ActionButton>

              <ActionButton
                onClick={() => handleExportEntry(entry)}
                label="导出 Markdown"
                ariaLabel={`导出 ${entry.title} Markdown`}
                className="text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 focus-visible:ring-emerald-500 dark:hover:bg-emerald-950/40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </ActionButton>

              <Link
                href={`/entries/${entry.id}`}
                aria-label={`编辑 ${entry.title}`}
                title="编辑条目"
                className="relative group/action inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-950/40"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-full z-40 mt-1.5 hidden whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1.5 text-[11px] font-normal text-white shadow-lg group-hover/action:block group-focus-visible/action:block dark:bg-zinc-700"
                >
                  编辑条目
                </span>
              </Link>

              <ActionButton
                onClick={() => setEntryPendingDelete(entry)}
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
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-pretty">本周计划</h1>
          <p className="mt-1 text-xs text-zinc-500">先决定本周把注意力放在哪里，再记录实际投入。</p>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
          <Calendar className="h-4 w-4 shrink-0 text-purple-500" aria-hidden="true" />
          <span className="font-medium text-zinc-500">周起始：</span>
          <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{weekPlan.weekStart || "加载中"}</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="本周投入摘要">
        <SummaryMetric label="本周关注" value={`${focusItems.length} 条`} />
        <SummaryMetric label="预计投入" value={formatHours(plannedFocusSeconds)} />
        <SummaryMetric label="实际投入" value={formatHours(actualFocusSeconds)} />
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
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

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="weekly-focus-heading">
          <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <div>
              <h2 id="weekly-focus-heading" className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
                <Target className="h-4 w-4" aria-hidden="true" />
                <span>本周关注</span>
              </h2>
              <p className="mt-1 text-[11px] text-zinc-500">持续方向和本周需要主动投入时间的项目。</p>
            </div>
            <span className="text-[11px] text-zinc-500">预计 {formatHours(plannedFocusSeconds)} · 已投入 {formatHours(actualFocusSeconds)}</span>
          </div>
          <div className="space-y-2 p-3">
            {focusItems.length === 0 ? (
              <EmptyState text="还没有本周关注的方向。可以从方向库加入，或先开始一次无归属专注。" />
            ) : focusItems.map((item) => {
              const entry = entriesById.get(item.entryId);
              if (!entry) return null;
              return (
                <FocusEntryRow
                  key={entry.id}
                  entry={entry}
                  item={item}
                  actualSeconds={weekEntryBreakdown.get(entry.id)?.aggregateSeconds ?? 0}
                  activeFocus={activeFocus}
                  onStart={() => void startFocus(entry.id)}
                  onUpdate={(input) => void updateWeekPlanItem(entry.id, input)}
                  onRemove={() => void mutate(() => api.removeFromWeekPlan(entry.id, selectedWeek), { backgroundRefresh: true, update: mergeWeekPlan })}
                />
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="entry-library-heading">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 id="entry-library-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Tag className="h-4 w-4 text-blue-500" aria-hidden="true" />
              <span>方向库 ({matchingEntries.length} / {entries.length} 个节点)</span>
            </h2>
            <p className="mt-1 text-[11px] text-zinc-500">管理长期方向和需要保留历史的事项；本周纳入状态在条目行中保留。</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />持续方向</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />可完成事项</span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 text-xs sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">搜索条目标题或描述</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索条目标题或描述…" aria-label="搜索条目标题或描述" className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700" />
            </label>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1 sm:flex-none">
                <span className="sr-only">筛选条目</span>
                <select value={entryFilter} onChange={(e) => setEntryFilter(e.target.value as EntryFilter)} aria-label="筛选条目" className="w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 sm:w-auto">
                  <option value="all">全部 ({filterCounts.all})</option>
                  <option value="unfinished">未完成 ({filterCounts.unfinished})</option>
                  <option value="completed">已完成 ({filterCounts.completed})</option>
                  <option value="archived">已归档 ({filterCounts.archived})</option>
                </select>
              </label>
              <button type="button" onClick={() => setIsCreateOpen(true)} aria-label="新建顶层条目" className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-zinc-900 px-3.5 py-2 font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900"><Plus className="h-3.5 w-3.5" aria-hidden="true" /><span>新建条目</span></button>
              <button type="button" onClick={handleExportAllEntries} disabled={entries.length === 0} aria-label="导出全部条目 Markdown" title="导出全部条目 Markdown" className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-3.5 py-2 font-medium text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><Download className="h-3.5 w-3.5" aria-hidden="true" /><span>导出全部</span></button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
            <span>{searchQuery.trim() || entryFilter !== "all" ? `匹配 ${matchingEntries.length} 个条目` : "按标题、状态或描述搜索与筛选"}</span>
            {(searchQuery || entryFilter !== "all") && <button type="button" onClick={() => { setSearchQuery(""); setEntryFilter("all"); }} className="shrink-0 font-medium text-blue-600 hover:underline dark:text-blue-400">清除筛选</button>}
          </div>

          <div className="space-y-1">
            {entries.length === 0 ? <p className="py-8 text-center text-xs text-zinc-400">尚未创建任何条目，请点击“新建条目”添加首个条目。</p> : rootEntries.length > 0 ? rootEntries.map((root) => renderTreeNode(root, 0)) : (
              <div className="py-8 text-center text-xs text-zinc-400"><p>没有符合当前搜索或筛选条件的条目。</p><button type="button" onClick={() => { setSearchQuery(""); setEntryFilter("all"); }} className="mt-2 font-medium text-blue-600 hover:underline dark:text-blue-400">显示全部条目</button></div>
            )}
          </div>
        </div>
      </section>

      <EntryCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="新建顶层条目"
        description="长期方向和需要保留历史的事项适合创建为结构化条目；临时待办可以直接写入本周清单。"
      />

      {entryPendingDelete && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open && !isDeleting) setEntryPendingDelete(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <div className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="font-semibold text-base">删除条目</Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    确定删除“{entryPendingDelete.title}”及其所有子条目吗？
                  </Dialog.Description>
                </div>
                <button
                  type="button"
                  aria-label="关闭删除确认对话框"
                  title="关闭"
                  disabled={isDeleting}
                  onClick={() => setEntryPendingDelete(null)}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50 dark:hover:text-zinc-200"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="px-5 py-4 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
                  删除后，这些条目会从计划树和本周计划中隐藏；历史专注记录仍会保留。
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setEntryPendingDelete(null)}
                  className="rounded-md border border-zinc-300 px-3.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => void handleDeleteEntry()}
                  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {isDeleting ? "删除中…" : "确认删除"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}

const formatHours = (seconds: number) => {
  if (seconds <= 0) return "0h";
  const hours = seconds / 3600;
  return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)}h`;
};

const formatPlannedFocus = (seconds: number | null) => {
  if (seconds === null) return "未设置";
  if (seconds === 0) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainderSeconds = seconds % 60;
  return [hours ? `${hours}h` : null, minutes ? `${minutes}m` : null, remainderSeconds ? `${remainderSeconds}s` : null]
    .filter(Boolean)
    .join(" ");
};

const SummaryMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="text-[11px] text-zinc-500">{label}</div>
    <div className="mt-1 font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-5 text-center text-xs text-zinc-400 dark:border-zinc-800">{text}</p>
);

const FocusEntryRow: React.FC<{
  entry: Entry;
  item: WeekPlanItem;
  actualSeconds: number;
  activeFocus: ReturnType<typeof useFocusTimer>["activeFocus"];
  onStart: () => void;
  onUpdate: (input: WeekPlanItemInput) => void;
  onRemove: () => void;
}> = ({ entry, item, actualSeconds, activeFocus, onStart, onUpdate, onRemove }) => {
  return (
    <div className="grid gap-3 rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-3 dark:border-purple-900/50 dark:bg-purple-950/20 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
          <Link href={`/entries/${entry.id}`} className="min-w-0 truncate text-sm font-semibold text-zinc-900 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-zinc-100 dark:hover:text-purple-300">
            {entry.title}
          </Link>
          {item.source === "rollover" && <span className="shrink-0 text-[10px] text-purple-600 dark:text-purple-400">结转</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-[11px] text-zinc-500">
          <span>已投入 {formatHours(actualSeconds)}</span>
          <div className="inline-flex items-center gap-1" aria-label={`${entry.title} 本周预计投入`}>
            <span>本周预计</span>
            <div className="inline-flex h-6 items-center rounded border border-purple-200 bg-white font-mono text-[11px] text-zinc-700 dark:border-purple-800 dark:bg-zinc-900 dark:text-zinc-200">
              <button
                type="button"
                onClick={() => onUpdate({
                  role: "focus",
                  plannedFocusSeconds: adjustPlannedFocusSeconds(item.plannedFocusSeconds, "decrease"),
                })}
                disabled={item.plannedFocusSeconds === null}
                aria-label={`减少 ${entry.title} 的本周预计投入 30 分钟`}
                title="减少 30 分钟"
                className="inline-flex h-full w-6 items-center justify-center border-r border-purple-100 text-zinc-500 hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-35 dark:border-purple-900/60 dark:hover:bg-purple-950/40 dark:hover:text-purple-300"
              >
                <Minus className="h-3 w-3" aria-hidden="true" />
              </button>
              <output className="min-w-14 px-1.5 text-center tabular-nums">{formatPlannedFocus(item.plannedFocusSeconds)}</output>
              <button
                type="button"
                onClick={() => onUpdate({
                  role: "focus",
                  plannedFocusSeconds: adjustPlannedFocusSeconds(item.plannedFocusSeconds, "increase"),
                })}
                aria-label={`增加 ${entry.title} 的本周预计投入 30 分钟`}
                title="增加 30 分钟"
                className="inline-flex h-full w-6 items-center justify-center border-l border-purple-100 text-zinc-500 hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-purple-900/60 dark:hover:bg-purple-950/40 dark:hover:text-purple-300"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onStart}
          disabled={Boolean(activeFocus)}
          aria-label={`开始专注 ${entry.title}`}
          title={activeFocus ? "已有活动中的专注" : "开始专注"}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-purple-600 px-2.5 text-xs font-medium text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-40 dark:bg-purple-700 dark:hover:bg-purple-600"
        >
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          <span>开始专注</span>
        </button>
        <ActionButton onClick={onRemove} label="移出本周关注" className="text-zinc-400 hover:bg-red-50 hover:text-red-500 focus-visible:ring-red-500 dark:hover:bg-red-950/40">
          <CalendarMinus className="h-3.5 w-3.5" aria-hidden="true" />
        </ActionButton>
      </div>
    </div>
  );
};

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
      setSaveError(error instanceof Error ? error.message : "保存清单失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-[22rem] flex-col space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 xl:min-h-[25rem]">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <h3 className="font-semibold text-xs flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <FileText className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
          <span>本周清单</span>
        </h3>
        <button
          onClick={() => { void handleToggleEdit(); }}
          disabled={isSaving}
          className="text-blue-600 dark:text-blue-400 text-[11px] hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? "保存中…" : isNoteEditing ? "保存清单" : "编辑清单"}
        </button>
      </div>

      {isNoteEditing ? (
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            rows={10}
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            aria-label="本周清单 Markdown 内容"
            className="min-h-[16rem] w-full flex-1 resize-y rounded-lg border border-zinc-300 bg-transparent p-3 text-xs font-mono leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
          />
          <p className="text-[10px] text-zinc-400">
            使用 Markdown：`- [ ]` / `- [x]` 表示事项，标题和缩进列表用于组织层级。
          </p>
        </div>
      ) : (
        <SafeMarkdown
          content={displayedNote}
          fallback="点击编辑，记录本周清单、临时事项和工作笔记…"
          className="min-h-[16rem] flex-1 space-y-2 rounded-lg border border-zinc-200/60 bg-zinc-50 p-4 text-xs leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-400"
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
