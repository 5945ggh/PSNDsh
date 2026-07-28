"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useData } from "@/context/MockContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { EntryCompletionMode, EntryStatus } from "@/lib/domain/types";
import { dateKeyToEndOfDayIso } from "@/lib/time/timezone";
import {
  ArrowLeft,
  Play,
  Save,
  Trash2,
  Archive,
  Clock,
  Layers,
  AlertCircle,
} from "lucide-react";

export default function EntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { api, data, mutate } = useData();
  const { startFocus } = useFocusTimer();

  const entry = data.entries.find((candidate) => candidate.id === id);
  const entries = data.entries;
  const focusSessions = data.focusSessions;

  const [title, setTitle] = useState(entry?.title || "");
  const [description, setDescription] = useState(entry?.description || "");
  const [completionMode, setCompletionMode] = useState(
    entry?.completionMode || "completable"
  );
  const [status, setStatus] = useState(entry?.status || "active");
  const [dueAt, setDueAt] = useState(
    entry?.dueAt ? entry.dueAt.slice(0, 10) : ""
  );
  const [parentId] = useState(entry?.parentId || "");

  if (!entry) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h1 className="text-lg font-semibold">未找到该条目</h1>
        <p className="text-xs text-zinc-500">条目可能已被删除或不存在。</p>
        <Link
          href="/plan"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-zinc-900 text-white text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回计划树</span>
        </Link>
      </div>
    );
  }

  const parentEntry = entry.parentId ? entries.find((candidate) => candidate.id === entry.parentId) ?? null : null;
  const childrenEntries = entries.filter((e) => e.parentId === entry.id);

  // Find focus timeline related to this entry
  const relatedSessions = focusSessions.filter((s) =>
    s.segments.some((seg) => seg.entryId === entry.id)
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutate(() => api.updateEntry(entry.id, {
        title,
        description: description || null,
        completionMode,
        status,
        dueAt: dateKeyToEndOfDayIso(dueAt),
        parentId: parentId || null,
      }), {
        backgroundRefresh: true,
        update: (snapshot, updatedEntry) => ({
          ...snapshot,
          entries: snapshot.entries.map((item) => item.id === updatedEntry.id ? updatedEntry : item),
        }),
      });
      alert("条目修改已保存");
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "条目修改失败");
    }
  };

  const handleArchive = async () => {
    try {
      await mutate(() => api.updateEntry(entry.id, { status: "archived" }), {
        backgroundRefresh: true,
        update: (snapshot, updatedEntry) => ({
          ...snapshot,
          entries: snapshot.entries.map((item) => item.id === updatedEntry.id ? updatedEntry : item),
        }),
      });
      alert("条目已放入归档");
    } catch (error) {
      alert(error instanceof Error ? error.message : "归档失败");
    }
  };

  const handleDeleteEntry = async () => {
    if (
      confirm(
        `确定删除条目 “${entry.title}” 及其所有子节点吗？删除后它们会从计划树和本周计划中隐藏，历史专注记录仍会保留。`
      )
    ) {
      await mutate(() => api.deleteEntry(entry.id));
      router.push("/plan");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/plan"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回计划树</span>
        </Link>

        <button
          onClick={() => startFocus(entry.id)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>为此条目开启专注</span>
        </button>
      </div>

      {/* Main Details Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mb-1">
              <span>ID: {entry.id}</span>
              {parentEntry && (
                <>
                  <span>•</span>
                  <span>父级：{parentEntry.title}</span>
                </>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight">{entry.title}</h1>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              entry.status === "active"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                : entry.status === "completed"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            状态：{entry.status}
          </span>
        </div>

        {/* Metrics Card */}
        <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-lg border border-zinc-200/70 dark:border-zinc-700/60 text-xs">
          <div>
            <span className="text-zinc-400">直接投入时长 (Direct Focus)</span>
            <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              {(entry.directFocusSeconds / 3600).toFixed(2)} 小时
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              直接在该节点上记录的专注片段累加
            </p>
          </div>

          <div>
            <span className="text-zinc-400">聚合投入时长 (Aggregate Focus)</span>
            <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
              {(entry.aggregateFocusSeconds / 3600).toFixed(2)} 小时
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              自身直接投入 + 全部后代子节点投入递归向上求和
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              条目标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              条目描述 / 备注
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加针对此条目的具体说明或要求..."
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                完成模式
              </label>
              <select
                value={completionMode}
                onChange={(e) =>
                  setCompletionMode(e.target.value as EntryCompletionMode)
                }
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent outline-none"
              >
                <option value="completable">可完成型 (待办类项目)</option>
                <option value="ongoing">持续型 (长期积累方向)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                当前状态
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EntryStatus)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent outline-none"
              >
                <option value="active">活跃 (Active)</option>
                <option value="paused">暂停 (Paused)</option>
                {completionMode === "completable" && <option value="completed">完成 (Completed)</option>}
                <option value="archived">归档 (Archived)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                截止日期 (Due Date)
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent font-mono outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleArchive}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>放入归档</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteEntry}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除条目</span>
              </button>
            </div>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shadow-sm hover:opacity-90"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存修改</span>
            </button>
          </div>
        </form>
      </div>

      {/* Sub-entries List & Related Focus Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sub-entries */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>子条目列表 ({childrenEntries.length})</span>
          </h3>

          <div className="space-y-2 text-xs">
            {childrenEntries.length > 0 ? (
              childrenEntries.map((child) => (
                <div
                  key={child.id}
                  className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/50 flex items-center justify-between"
                >
                  <Link
                    href={`/entries/${child.id}`}
                    className="font-medium hover:text-blue-600 truncate pr-2"
                  >
                    {child.title}
                  </Link>
                  <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                    直接: {(child.directFocusSeconds / 3600).toFixed(1)}h
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-400 py-4">当前无子节点</p>
            )}
          </div>
        </div>

        {/* Related Focus Timeline */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Clock className="w-4 h-4 text-purple-500" />
            <span>相关专注历史时间线</span>
          </h3>

          <div className="space-y-2 text-xs">
            {relatedSessions.length > 0 ? (
              relatedSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-2.5 rounded-lg bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-1"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-purple-700 dark:text-purple-300">
                    <span>
                      {session.startedAt.slice(0, 10)} {session.startedAt.slice(11, 16)}–{session.endedAt?.slice(11, 16) || "进行中"}
                    </span>
                    <span className="font-medium">
                      {session.captureMode === "timer" ? "计时" : "补录"}
                    </span>
                  </div>
                  {session.outcome && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                      成果：{session.outcome}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-400 py-4">尚未为此条目记录专注历史</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
