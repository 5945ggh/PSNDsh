"use client";

import React, { useMemo, useState } from "react";
import { useData } from "@/context/MockContext";
import { ClipboardCheck, Clock3, ListChecks, MessageSquareText, RotateCcw } from "lucide-react";

const hours = (seconds: number) => `${(seconds / 3600).toFixed(1)} 小时`;

export default function ReviewPage() {
  const { api, data, mutate } = useData();
  const [note, setNote] = useState(data.currentWeekPlan?.note ?? "");
  const [saved, setSaved] = useState(false);
  const plan = data.currentWeekPlan;
  const stats = data.statistics.week;
  const entriesById = useMemo(() => new Map(data.entries.map((entry) => [entry.id, entry])), [data.entries]);
  const plannedEntries = useMemo(
    () => (plan?.items ?? []).map((item) => entriesById.get(item.entryId)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [entriesById, plan?.items]
  );
  const completedCount = plannedEntries.filter((entry) => entry.status === "completed").length;
  const unfinished = plannedEntries.filter((entry) => entry.status !== "completed" && entry.status !== "archived");
  const weekSeconds = stats?.totalSeconds ?? data.focusSessions.reduce((sum, session) => {
    if (!session.endedAt) return sum;
    return sum + Math.max(0, (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000);
  }, 0);
  const unassignedSeconds = stats?.unassignedSeconds ?? 0;
  const directByEntry = useMemo(() => new Map((stats?.entryBreakdown ?? []).map((item) => [item.entryId, item.directSeconds])), [stats?.entryBreakdown]);
  const plannedFocusSeconds = plannedEntries.reduce((sum, entry) => sum + (directByEntry.get(entry.id) ?? 0), 0);

  const saveNote = async () => {
    await mutate(() => api.updateWeekPlanNote(note, plan?.weekStart), {
      backgroundRefresh: true,
      update: (snapshot, nextNotePlan) => ({ ...snapshot, currentWeekPlan: nextNotePlan }),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="space-y-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              <span>本周复盘</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">把这一周收束成下一步</h1>
            <p className="mt-1 text-sm text-zinc-500">这里是当前周计划的计算视图，不会额外保存复盘历史。</p>
          </div>
          <div className="font-mono text-xs tabular-nums text-zinc-500">周起始 {plan?.weekStart || "未建立"}</div>
        </header>

        <section aria-labelledby="review-overview" className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 id="review-overview" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">本周概览</h2>
            <span className="text-xs text-zinc-500">计划、实际投入和未关联时长</span>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500"><ListChecks className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />计划完成</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{completedCount}/{plannedEntries.length}</dd></div>
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500"><Clock3 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />总专注</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{hours(weekSeconds)}</dd></div>
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500">已关联投入</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{hours(plannedFocusSeconds)}</dd></div>
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500">未关联投入</dt><dd className="mt-2 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{hours(unassignedSeconds)}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="review-next" className="space-y-4">
          <div className="flex items-center gap-2"><h2 id="review-next" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">建议带入下周</h2><RotateCcw className="h-4 w-4 text-zinc-400" aria-hidden="true" /></div>
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {unfinished.length === 0 ? <p className="text-sm text-zinc-500">本周计划中没有需要结转的未完成条目。</p> : <div className="space-y-2">{unfinished.map((entry) => <div key={entry.id} className="flex items-center justify-between border-b border-zinc-100 pb-2 text-sm dark:border-zinc-800"><span className="truncate text-zinc-800 dark:text-zinc-200">{entry.title}</span><span className="ml-3 shrink-0 text-xs text-zinc-500">{entry.status === "paused" ? "已暂停" : "未完成"}</span></div>)}</div>}
          </div>
        </section>

        <section aria-labelledby="review-note" className="space-y-4">
          <div className="flex items-center gap-2"><h2 id="review-note" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200"><MessageSquareText className="mr-1 inline h-4 w-4" aria-hidden="true" />周备注</h2><span className="text-xs text-zinc-500">沿用当前周计划备注</span></div>
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} maxLength={2000} aria-label="本周复盘备注" className="w-full resize-y border border-zinc-200 bg-white p-3 text-sm leading-6 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-800 dark:bg-zinc-950" placeholder="记录本周最值得保留的一件事，以及下周要调整的一件事。" />
            <div className="mt-3 flex items-center justify-end gap-3"><span className="text-xs text-emerald-600 dark:text-emerald-400" aria-live="polite">{saved ? "已保存" : ""}</span><button type="button" onClick={() => void saveNote()} className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">保存备注</button></div>
          </div>
        </section>
      </div>
    </div>
  );
}
