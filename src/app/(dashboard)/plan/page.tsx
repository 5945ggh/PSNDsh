"use client";

import React, { useState } from "react";
import Link from "next/link";
import { type DataSnapshot, useData } from "@/context/MockContext";
import { SafeMarkdown } from "@/components/common/SafeMarkdown";
import { Entry, EntryCompletionMode, WeekPlan } from "@/types/mock";
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
} from "lucide-react";

export default function PlanPage() {
  const { api, data, mutate } = useData();
  const entries = data.entries;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(["entry_ics2", "entry_ostep", "entry_lab4", "entry_ai_ethics", "entry_other", "entry_github"])
  );
  const weekPlan = data.currentWeekPlan ?? { weekStart: "", note: "", items: [] };
  const selectedWeek = weekPlan.weekStart || undefined;
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<EntryCompletionMode>("completable");
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

  const handleCreateTopEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await mutate(() => api.addEntry({
      parentId: null,
      title: newTitle.trim(),
      description: null,
      completionMode: newMode,
      dueAt: null,
    }), {
      backgroundRefresh: true,
      update: mergeEntry,
    });
    setNewTitle("");
  };

  const rootEntries = entries.filter((e) => e.parentId === null);

  const renderTreeNode = (entry: Entry, depth: number = 0) => {
    const children = entries.filter((e) => e.parentId === entry.id);
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
                <button
                  onClick={() => void mutate(() => api.removeFromWeekPlan(entry.id, selectedWeek), {
                    backgroundRefresh: true,
                    update: mergeWeekPlan,
                  })}
                  aria-label="从本周移出"
                  className="p-1 rounded text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <CalendarMinus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ) : (
                <button
                  onClick={() => void mutate(() => api.addToWeekPlan(entry.id, selectedWeek), {
                    backgroundRefresh: true,
                    update: mergeWeekPlan,
                  })}
                  aria-label="加入本周计划"
                  className="p-1 rounded text-zinc-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                >
                  <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}

              <button
                onClick={() =>
                  void mutate(() => api.updateEntry(entry.id, {
                    status:
                      entry.status === "completed" ? "active" : "completed",
                  }), {
                    backgroundRefresh: true,
                    update: mergeEntry,
                  })
                }
                aria-label={entry.status === "completed" ? "标记为未完成" : "标记为已完成"}
                className={`p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  entry.status === "completed"
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
                    : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <button
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
                aria-label="添加子条目"
                className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
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
                <span>条目结构 ({entries.length} 个节点)</span>
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

            {/* Quick Add Top Entry Form */}
            <form onSubmit={handleCreateTopEntry} className="flex gap-2 text-xs">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="快速添加顶层条目（例如：算法练习 / 论文阅读）…"
                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as EntryCompletionMode)}
                className="px-2.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="completable">可完成型 (待办)</option>
                <option value="ongoing">持续型 (长期方向)</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:opacity-90 flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>创建</span>
              </button>
            </form>

            {/* Render Tree */}
            <div className="space-y-1.5 pt-1">
              {rootEntries.length > 0 ? (
                rootEntries.map((root) => renderTreeNode(root, 0))
              ) : (
                <p className="text-xs text-zinc-400 py-8 text-center">
                  尚未创建任何条目，请使用上方输入框添加首个条目。
                </p>
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

                    <button
                      onClick={() => void mutate(() => api.removeFromWeekPlan(ent.id, selectedWeek), {
                        backgroundRefresh: true,
                        update: mergeWeekPlan,
                      })}
                      aria-label="从该周移出"
                      className="text-zinc-400 hover:text-red-500 p-1 rounded shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <CalendarMinus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
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
