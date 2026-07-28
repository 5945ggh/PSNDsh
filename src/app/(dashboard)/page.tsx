"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useData } from "@/context/MockContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { EntryCreateDialog } from "@/components/entries/EntryCreateDialog";
import {
  DEFAULT_TIMEZONE,
  deadlineStatusInTimezone,
  formatDateKeyInTimezone,
  formatDateLabelInTimezone,
  formatTimeInTimezone,
  getHourInTimezone,
  greetingForHour,
} from "@/lib/time/timezone";
import {
  Sun,
  CloudOff,
  Quote,
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const { data } = useData();
  const { activeFocus, startFocus, formattedTime } = useFocusTimer();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const payload = data.dashboard;
  if (!payload) {
    return <div className="p-8 text-sm text-zinc-500">正在加载首页数据...</div>;
  }

  const {
    profile,
    weather,
    quotation,
    nextSchedule,
    todayEntries,
    deadlineEntries,
    focusSummary,
  } = payload;
  const timezone = data.capabilities?.effectiveTimezone ?? DEFAULT_TIMEZONE;
  const now = new Date(payload.now);
  const todayHours = (focusSummary.todaySeconds / 3600).toFixed(1);
  const weekHours = (focusSummary.weekSeconds / 3600).toFixed(1);
  const currentDateLabel = formatDateLabelInTimezone(now, timezone);
  const greeting = greetingForHour(getHourInTimezone(now, timezone));
  const displayName = profile.nickname || profile.username;
  const visibleDeadlineEntries = deadlineEntries
    .map((entry) => ({
      entry,
      status: deadlineStatusInTimezone(entry.dueAt, now, timezone),
    }))
    .filter(
      (item): item is {
        entry: (typeof deadlineEntries)[number];
        status: "overdue" | "upcoming";
      } => item.status !== null,
    );

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <div className="space-y-6">
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                <span>{currentDateLabel}</span>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-pretty md:text-2xl">
                {greeting}，{displayName}
              </h1>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs dark:border-zinc-700/60 dark:bg-zinc-800/60">
              {weather.status === "fresh" && (
                <>
                  <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  <div>
                    <div className="font-medium text-zinc-800 dark:text-zinc-200">
                      {weather.summary}
                    </div>
                    <div className="text-[10px] text-zinc-400">实时气象已更新</div>
                  </div>
                </>
              )}

              {weather.status === "stale" && (
                <>
                  <Sun className="h-4 w-4 text-amber-600/70" aria-hidden="true" />
                  <div>
                    <div className="font-medium text-zinc-700 dark:text-zinc-300">
                      {weather.summary}
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">
                      旧缓存记录 ({weather.observedAt})
                    </div>
                  </div>
                </>
              )}

              {weather.status === "unavailable" && (
                <>
                  <CloudOff className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                  <div>
                    <div className="font-medium text-zinc-500">天气未配置</div>
                    <div className="text-[10px] text-zinc-400">首版不启用天气服务</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-zinc-200/60 bg-zinc-50/70 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-400">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
            <div className="italic">
              “{quotation.text}” —— {" "}
              <span className="not-italic font-medium text-zinc-700 dark:text-zinc-300">
                {quotation.author}
              </span>{" "}
              {quotation.work}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col justify-between space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Clock className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                当前专注状态
              </span>
              {activeFocus && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  进行中
                </span>
              )}
            </div>

            {activeFocus ? (
              <div className="space-y-3">
                <div className="font-mono text-3xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {formattedTime}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  开始于 {formatTimeInTimezone(activeFocus.startedAt, timezone)} ·{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">无归属专注</span>
                </p>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  暂无活动中的专注计时
                </p>
                <p className="text-xs text-zinc-500">
                  随时开启一次无归属专注，结束后可将时间分配至对应条目。
                </p>
              </div>
            )}

            {!activeFocus && (
              <button
                type="button"
                onClick={() => startFocus(null)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>立即开始专注</span>
              </button>
            )}
          </div>

          <div className="flex flex-col justify-between space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Calendar className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />
                下一项日程
              </span>
              <Link
                href="/calendar"
                className="flex items-center gap-1 rounded text-xs text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
              >
                <span>查看周历</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>

            {nextSchedule ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    {nextSchedule.kind === "course" ? "课程" : "日程"}
                  </span>
                  <h2 className="text-sm font-semibold">{nextSchedule.title}</h2>
                </div>
                <p className="font-mono text-xs text-zinc-500">
                  时间：{formatTimeInTimezone(nextSchedule.startedAt, timezone)} – {" "}
                  {formatTimeInTimezone(nextSchedule.endedAt, timezone)}
                </p>
                {nextSchedule.location && (
                  <p className="text-xs text-zinc-500">地点：{nextSchedule.location}</p>
                )}
              </div>
            ) : (
              <p className="py-4 text-xs text-zinc-500">今日后续暂无日程安排</p>
            )}

            <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
              <span>
                今日累计：<strong className="tabular-nums text-zinc-800 dark:text-zinc-200">{todayHours}h</strong>
              </span>
              <span>
                本周累计：<strong className="tabular-nums text-zinc-800 dark:text-zinc-200">{weekHours}h</strong>
              </span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 text-pretty dark:text-zinc-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                <span>本周核心条目 ({todayEntries.length})</span>
              </h2>
              <Link
                href="/plan"
                className="flex items-center gap-1 rounded text-xs text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
              >
                <span>计划树</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="space-y-2">
              {todayEntries.length > 0 ? (
                todayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200/70 bg-zinc-50 p-3 text-xs transition-colors hover:border-zinc-300 dark:border-zinc-700/50 dark:bg-zinc-800/40"
                  >
                    <div className="space-y-1 truncate pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            entry.completionMode === "ongoing" ? "bg-blue-500" : "bg-emerald-500"
                          }`}
                          aria-hidden="true"
                        />
                        <Link
                          href={`/entries/${entry.id}`}
                          className="truncate rounded font-medium text-zinc-800 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-200 dark:hover:text-blue-400"
                        >
                          {entry.title}
                        </Link>
                      </div>
                      {entry.description && (
                        <p className="truncate pl-4 text-[11px] text-zinc-400">{entry.description}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                        聚合: {(entry.aggregateFocusSeconds / 3600).toFixed(1)}h
                      </span>
                      <button
                        type="button"
                        onClick={() => startFocus(entry.id)}
                        className="rounded bg-blue-600/10 px-2.5 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:text-blue-400"
                      >
                        专注
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
                  <div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      本周还没有可执行条目
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      直接在这里创建一项并加入本周，之后即可开始专注记录。
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      新建本周条目
                    </button>
                    <Link
                      href="/plan"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <span>{data.entries.length > 0 ? "从已有条目中选择" : "打开计划树查看更多选项"}</span>
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 text-pretty dark:text-zinc-200">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <span>临期与逾期提醒</span>
            </h2>

            <div className="space-y-2.5">
              {visibleDeadlineEntries.length > 0 ? (
                visibleDeadlineEntries.map(({ entry: ent, status }) => {
                  const isOverdue = status === "overdue";
                  return (
                    <div
                      key={ent.id}
                      className={`space-y-1 rounded-lg border p-3 text-xs ${
                        isOverdue
                          ? "border-red-200 bg-red-50/60 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                          : "border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <Link
                          href={`/entries/${ent.id}`}
                          className="truncate rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          {ent.title}
                        </Link>
                        <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
                          {isOverdue ? "已逾期" : "即将截止"}
                        </span>
                      </div>
                      {ent.dueAt && (
                        <p className="font-mono text-[10px] opacity-80">
                          截止时间：{formatDateKeyInTimezone(ent.dueAt, timezone)} {formatTimeInTimezone(ent.dueAt, timezone)}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-xs text-zinc-400">暂无临期或逾期事项</p>
              )}
            </div>
          </div>
        </section>

        <EntryCreateDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          addToWeekPlan
          title="新建本周条目"
          description="创建后会自动加入本周计划，也可以继续在计划树中补充细节。"
        />
      </div>
    </div>
  );
}
