"use client";

import React from "react";
import Link from "next/link";
import { useMock } from "@/context/MockContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
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
  const { api } = useMock();
  const { activeFocus, startFocus, formattedTime } = useFocusTimer();

  const payload = api.getDashboardPayload();
  const { profile, weather, quotation, nextSchedule, todayEntries, deadlineEntries, focusSummary } =
    payload;

  const todayHours = (focusSummary.todaySeconds / 3600).toFixed(1);
  const weekHours = (focusSummary.weekSeconds / 3600).toFixed(1);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header Banner: Greeting + Weather + Quotation */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <span>2026年6月26日 星期五</span>
              <span>•</span>
              <span className="text-zinc-600 dark:text-zinc-400">夏至</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-pretty mt-1">
              早安，{profile.nickname || profile.username}
            </h1>
          </div>

          {/* Weather Pill */}
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs">
            {weather.status === "fresh" && (
              <>
                <Sun className="w-4 h-4 text-amber-500 animate-spin-slow" aria-hidden="true" />
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
                <Sun className="w-4 h-4 text-amber-600/70" aria-hidden="true" />
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
                <CloudOff className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                <div>
                  <div className="font-medium text-zinc-500">天气暂时不可用</div>
                  <div className="text-[10px] text-zinc-400">接口连接超时</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quotation strip */}
        <div className="flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50/70 dark:bg-zinc-800/30 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
          <Quote className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="italic">
            “{quotation.text}” —— <span className="not-italic font-medium text-zinc-700 dark:text-zinc-300">{quotation.author}</span> {quotation.work}
          </div>
        </div>
      </div>

      {/* Grid Section: Active Focus Card & Next Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Active Focus Box */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
              当前专注状态
            </span>
            {activeFocus && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                进行中
              </span>
            )}
          </div>

          {activeFocus ? (
            <div className="space-y-3">
              <div className="text-3xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                {formattedTime}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                开始于 {activeFocus.startedAt.slice(11, 16)} •{" "}
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                  无归属专注
                </span>
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
              onClick={() => startFocus(null)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>立即开始专注</span>
            </button>
          )}
        </div>

        {/* Next Schedule Item */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
              下一项日程
            </span>
            <Link
              href="/calendar"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <span>查看周历</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>

          {nextSchedule ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  {nextSchedule.kind === "course" ? "课程" : "日程"}
                </span>
                <h3 className="font-semibold text-sm">{nextSchedule.title}</h3>
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                时间：{nextSchedule.startedAt.slice(11, 16)} – {nextSchedule.endedAt.slice(11, 16)}
              </p>
              {nextSchedule.location && (
                <p className="text-xs text-zinc-500">地点：{nextSchedule.location}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-4">今日后续暂无日程安排</p>
          )}

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span>今日累计：<strong className="text-zinc-800 dark:text-zinc-200 tabular-nums">{todayHours}h</strong></span>
            <span>本周累计：<strong className="text-zinc-800 dark:text-zinc-200 tabular-nums">{weekHours}h</strong></span>
          </div>
        </div>
      </div>

      {/* Main Lists Section: Today Entries & Deadline Warnings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Today Items (2 cols) */}
        <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 text-pretty">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              <span>本周核心条目 ({todayEntries.length})</span>
            </h2>
            <Link
              href="/plan"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <span>计划树</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>

          <div className="space-y-2">
            {todayEntries.length > 0 ? (
              todayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-700/50 hover:border-zinc-300 transition-colors text-xs"
                >
                  <div className="space-y-1 truncate pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          entry.completionMode === "ongoing"
                            ? "bg-blue-500"
                            : "bg-emerald-500"
                        }`}
                        aria-hidden="true"
                      />
                      <Link
                        href={`/entries/${entry.id}`}
                        className="font-medium text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                      >
                        {entry.title}
                      </Link>
                    </div>
                    {entry.description && (
                      <p className="text-[11px] text-zinc-400 truncate pl-4">
                        {entry.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                      聚合: {(entry.aggregateFocusSeconds / 3600).toFixed(1)}h
                    </span>
                    <button
                      onClick={() => startFocus(entry.id)}
                      className="px-2.5 py-1 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      专注
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-400 py-6 text-center">
                暂无本周计划条目，可在“计划”中将条目加入本周
              </p>
            )}
          </div>
        </div>

        {/* Deadline & Overdue Warnings (1 col) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 text-pretty">
            <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <span>临期与逾期提醒</span>
          </h2>

          <div className="space-y-2.5">
            {deadlineEntries.length > 0 ? (
              deadlineEntries.map((ent) => {
                const isOverdue = ent.dueAt && new Date(ent.dueAt) < new Date("2026-06-26");
                return (
                  <div
                    key={ent.id}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      isOverdue
                        ? "bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                        : "bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <Link href={`/entries/${ent.id}`} className="hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded">
                        {ent.title}
                      </Link>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0">
                        {isOverdue ? "已逾期" : "即将截止"}
                      </span>
                    </div>
                    {ent.dueAt && (
                      <p className="text-[10px] font-mono opacity-80">
                        截止时间：{ent.dueAt.slice(0, 16).replace("T", " ")}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-zinc-400 py-6 text-center">暂无临期或逾期事项</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
