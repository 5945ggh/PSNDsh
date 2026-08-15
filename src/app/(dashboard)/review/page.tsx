"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useData } from "@/context/MockContext";
import type { Entry, StatisticsPayload, WeekPlan } from "@/lib/domain/types";
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  MessageSquareText,
  RotateCcw,
} from "lucide-react";

type ReviewSnapshot = {
  weekStart: string;
  plan: WeekPlan | null;
  statistics: StatisticsPayload;
  nextPlan: WeekPlan | null;
  nextStatistics: StatisticsPayload;
};

const hours = (seconds: number) => `${(seconds / 3600).toFixed(1)} 小时`;

const shiftWeek = (weekStart: string, weeks: number) => {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
};

const weekStartForDate = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
};

const formatWeekRange = (weekStart: string) => {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const format = (date: Date) =>
    `${sameYear ? "" : `${date.getUTCFullYear()}年`}${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  return `${format(start)}至${format(end)}`;
};

const plannedEntries = (plan: WeekPlan | null, entriesById: Map<string, Entry>) =>
  (plan?.items ?? [])
    .map((item) => entriesById.get(item.entryId))
    .filter((entry): entry is Entry => Boolean(entry));

function ReviewSummary({
  title,
  weekStart,
  plan,
  statistics,
  entriesById,
  description,
}: {
  title: string;
  weekStart: string;
  plan: WeekPlan | null;
  statistics: StatisticsPayload;
  entriesById: Map<string, Entry>;
  description: string;
}) {
  const entries = plannedEntries(plan, entriesById);
  const completedCount = entries.filter((entry) => entry.status === "completed").length;
  const directByEntry = new Map(
    statistics.entryBreakdown.map((item) => [item.entryId, item.directSeconds] as const)
  );
  const linkedFocusSeconds = entries.reduce(
    (sum, entry) => sum + (directByEntry.get(entry.id) ?? 0),
    0
  );

  return (
    <section
      aria-labelledby={`review-${weekStart}`}
      className="border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h2 id={`review-${weekStart}`} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">{formatWeekRange(weekStart)} · {description}</p>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500">{weekStart}</span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500"><ListChecks className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />计划完成</dt>
          <dd className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{plan ? `${completedCount}/${entries.length}` : "--"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500"><Clock3 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />总专注</dt>
          <dd className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{hours(statistics.totalSeconds)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">已关联投入</dt>
          <dd className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{hours(linkedFocusSeconds)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">未关联投入</dt>
          <dd className="mt-1.5 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{hours(statistics.unassignedSeconds)}</dd>
        </div>
      </dl>
      {!plan && (
        <p className="mt-4 text-sm leading-6 text-zinc-500">该周未建立计划；统计按实际专注记录计算，已关联投入仅统计计划内条目。</p>
      )}
    </section>
  );
}

function RolloverList({
  selectedWeekStart,
  nextPlan,
  entriesById,
}: {
  selectedWeekStart: string;
  nextPlan: WeekPlan | null;
  entriesById: Map<string, Entry>;
}) {
  const rollovers = (nextPlan?.items ?? []).filter((item) => item.source === "rollover");

  return (
    <section aria-labelledby="review-rollover" className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        <h2 id="review-rollover" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">已带入下一周</h2>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{formatWeekRange(shiftWeek(selectedWeekStart, 1))} 的实际结转记录</p>

      {!nextPlan ? (
        <p className="mt-4 text-sm leading-6 text-zinc-500">下一周计划尚未建立，暂无结转记录。</p>
      ) : rollovers.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-zinc-500">没有条目实际结转到下一周。</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rollovers.map((item) => {
            const entry = entriesById.get(item.entryId);
            return (
              <li key={item.entryId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{entry?.title ?? "已删除条目"}</span>
                <span className="shrink-0 text-xs text-zinc-500">{entry?.status === "completed" ? "现已完成" : entry?.status === "paused" ? "已暂停" : "继续进行"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function ReviewPage() {
  const { api, data, mutate, version } = useData();
  const currentWeekStart = data.currentWeekPlan?.weekStart ?? data.statistics.week?.daily[0]?.date ?? null;
  const previousWeekStart = currentWeekStart ? shiftWeek(currentWeekStart, -1) : null;
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentWeekNote, setCurrentWeekNote] = useState("");
  const [currentWeekNoteWeekStart, setCurrentWeekNoteWeekStart] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  const entriesById = useMemo(
    () => new Map(data.entries.map((entry) => [entry.id, entry])),
    [data.entries]
  );

  const activeWeekStart = selectedWeekStart ?? previousWeekStart;

  useEffect(() => {
    if (!activeWeekStart || !currentWeekStart) return;
    const nextWeekStart = shiftWeek(activeWeekStart, 1);
    let cancelled = false;

    const selectedPlan = activeWeekStart === currentWeekStart
      ? Promise.resolve(data.currentWeekPlan)
      : api.getExistingWeekPlan(activeWeekStart);
    const selectedStatistics = activeWeekStart === currentWeekStart && data.statistics.week
      ? Promise.resolve(data.statistics.week)
      : api.getStatisticsPayload("week", activeWeekStart);
    const nextPlan = nextWeekStart === currentWeekStart
      ? Promise.resolve(data.currentWeekPlan)
      : api.getExistingWeekPlan(nextWeekStart);
    const nextStatistics = nextWeekStart === currentWeekStart && data.statistics.week
      ? Promise.resolve(data.statistics.week)
      : api.getStatisticsPayload("week", nextWeekStart);

    void Promise.all([selectedPlan, selectedStatistics, nextPlan, nextStatistics])
      .then(([plan, statistics, followingPlan, followingStatistics]) => {
        if (!cancelled) setSnapshot({ weekStart: activeWeekStart, plan, statistics, nextPlan: followingPlan, nextStatistics: followingStatistics });
      })
      .catch(() => {
        if (!cancelled) setLoadError("未能加载该周回顾，请稍后重试。");
      });

    return () => {
      cancelled = true;
    };
  }, [activeWeekStart, api, currentWeekStart, data.currentWeekPlan, data.statistics.week, version]);

  const nextWeekStart = activeWeekStart ? shiftWeek(activeWeekStart, 1) : null;
  const nextIsCurrentWeek = Boolean(nextWeekStart && currentWeekStart === nextWeekStart);
  const displayedCurrentWeekNote = currentWeekNoteWeekStart === currentWeekStart
    ? currentWeekNote
    : snapshot?.nextPlan?.note ?? data.currentWeekPlan?.note ?? "";

  const saveCurrentWeekNote = async () => {
    if (!currentWeekStart) return;
    const savedPlan = await mutate(
      () => api.updateWeekPlanNote(displayedCurrentWeekNote, currentWeekStart),
      {
        backgroundRefresh: true,
        update: (current, updatedPlan) => ({ ...current, currentWeekPlan: updatedPlan }),
      }
    );
    setSnapshot((current) => current ? { ...current, nextPlan: savedPlan } : current);
    setCurrentWeekNoteWeekStart(currentWeekStart);
    setCurrentWeekNote(savedPlan.note);
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 1800);
  };

  const selectWeek = (next: string | null) => {
    if (!next || !previousWeekStart || next > previousWeekStart) return;
    setSelectedWeekStart(next);
    setLoadError(null);
  };

  if (!activeWeekStart || !previousWeekStart || !snapshot || snapshot.weekStart !== activeWeekStart || !nextWeekStart) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-zinc-500" aria-live="polite">
        <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
        <span>{loadError ?? "正在加载周度回顾..."}</span>
      </div>
    );
  }

  const selectedIsPreviousWeek = activeWeekStart === previousWeekStart;
  const selectedTitle = selectedIsPreviousWeek ? "上周复盘" : `${activeWeekStart} 周度回顾`;
  const nextTitle = nextIsCurrentWeek ? "本周进展" : "下一周进展";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:py-8">
      <div className="space-y-8">
        <header className="flex flex-col gap-5 border-b border-zinc-200 pb-5 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span>周度回顾</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">回看投入，延续真正重要的事</h1>
            <p className="mt-1 text-sm text-zinc-500">上周复盘与本周进展并列呈现；历史周按实际记录只读查看。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="周度回顾导航">
            <button type="button" onClick={() => selectWeek(shiftWeek(activeWeekStart, -1))} className="inline-flex h-9 w-9 items-center justify-center border border-zinc-200 text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="上一周" title="上一周">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <label className="relative flex items-center">
              <CalendarDays className="pointer-events-none absolute left-2.5 h-4 w-4 text-zinc-400" aria-hidden="true" />
              <input type="date" aria-label="复盘周起始日" value={activeWeekStart} max={previousWeekStart} onChange={(event) => selectWeek(weekStartForDate(event.target.value))} className="h-9 border border-zinc-200 bg-white py-1 pl-8 pr-2 text-sm text-zinc-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </label>
            <button type="button" onClick={() => selectWeek(shiftWeek(activeWeekStart, 1))} disabled={selectedIsPreviousWeek} className="inline-flex h-9 w-9 items-center justify-center border border-zinc-200 text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="下一周" title="下一周">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {!selectedIsPreviousWeek && <button type="button" onClick={() => setSelectedWeekStart(previousWeekStart)} className="h-9 border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">回到上周</button>}
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-2">
          <ReviewSummary title={selectedTitle} weekStart={activeWeekStart} plan={snapshot.plan} statistics={snapshot.statistics} entriesById={entriesById} description="计划、实际投入和未关联时长" />
          <ReviewSummary title={nextTitle} weekStart={nextWeekStart} plan={snapshot.nextPlan} statistics={snapshot.nextStatistics} entriesById={entriesById} description="与上一周连续对照" />
        </div>

        <div className="mt-32 grid gap-8 xl:mt-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-8">
            <RolloverList selectedWeekStart={activeWeekStart} nextPlan={snapshot.nextPlan} entriesById={entriesById} />
            <section aria-labelledby="review-selected-note" className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                <h2 id="review-selected-note" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">该周备注</h2>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">{snapshot.plan?.note.trim() || "该周没有留下备注。"}</p>
            </section>
          </div>

          {nextIsCurrentWeek && (
            <section aria-labelledby="review-current-note" className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                <h2 id="review-current-note" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">本周备注</h2>
              </div>
              <p className="mt-1 text-xs text-zinc-500">记录当前观察与待调整事项。</p>
              <textarea value={displayedCurrentWeekNote} onChange={(event) => { setCurrentWeekNoteWeekStart(currentWeekStart); setCurrentWeekNote(event.target.value); }} rows={6} maxLength={2000} aria-label="本周复盘备注" className="mt-4 w-full resize-y border border-zinc-200 bg-white p-3 text-sm leading-6 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-800 dark:bg-zinc-950" placeholder="记录本周最值得保留的一件事，以及后续要调整的一件事。" />
              <div className="mt-3 flex items-center justify-end gap-3">
                <span className="text-xs text-emerald-600 dark:text-emerald-400" aria-live="polite">{noteSaved ? "已保存" : ""}</span>
                <button type="button" onClick={() => void saveCurrentWeekNote()} className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">保存备注</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
