"use client";

import React, { useState } from "react";
import { useMock } from "@/context/MockContext";
import {
  BarChart3,
  PieChart,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function StatisticsPage() {
  const { api } = useMock();
  const [scale, setScale] = useState<"day" | "week" | "month">("week");
  const [expandedRootId, setExpandedRootId] = useState<string | null>("entry_ics2");

  const stats = api.getStatisticsPayload(scale);
  const entries = api.getEntries();

  const totalHours = (stats.totalSeconds / 3600).toFixed(1);
  const unassignedHours = (stats.unassignedSeconds / 3600).toFixed(1);

  const rootEntries = entries.filter((e) => e.parentId === null);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header & Scale Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-pretty">时间与投入统计</h1>
          <p className="text-xs text-zinc-500 mt-1">
            追溯时间去向。清晰区分直接投入与递归聚合投入，防止重复统计。
          </p>
        </div>

        {/* Scale buttons */}
        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs bg-zinc-50 dark:bg-zinc-800 shrink-0">
          {(["day", "week", "month"] as const).map((sc) => (
            <button
              key={sc}
              onClick={() => setScale(sc)}
              className={`px-3 py-1.5 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                scale === sc
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              {sc === "day" ? "日视图" : sc === "week" ? "周视图" : "月视图"}
            </button>
          ))}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>总专注时长 ({scale === "week" ? "本周" : "阶段"})</span>
            <Clock className="w-4 h-4 text-blue-500" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
            {totalHours} <span className="text-sm font-sans font-normal text-zinc-500">小时</span>
          </div>
          <p className="text-[11px] text-zinc-400">包含所有条目与未关联专注</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>未关联专注</span>
            <HelpCircle className="w-4 h-4 text-amber-500" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
            {unassignedHours} <span className="text-sm font-sans font-normal text-zinc-500">小时</span>
          </div>
          <p className="text-[11px] text-zinc-400">未分配给具体条目的专注记录</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>主要投入方向</span>
            <TrendingUp className="w-4 h-4 text-purple-500" aria-hidden="true" />
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
            ICS2
          </div>
          <p className="text-[11px] text-zinc-400 font-mono tabular-nums">
            聚合投入：5.25 小时 (41%)
          </p>
        </div>
      </div>

      {/* Daily Trend Chart with Readable Values */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-pretty">
          <BarChart3 className="w-4 h-4 text-blue-500" aria-hidden="true" />
          <span>每日专注趋势</span>
        </h2>

        <div className="grid grid-cols-7 gap-2 items-end h-40 pt-6 px-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
          {stats.daily.map((d) => {
            const h = (d.seconds / 3600).toFixed(1);
            const heightPct = Math.min(100, Math.max(10, (d.seconds / 14400) * 100));
            return (
              <div key={d.date} className="flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  {h}h
                </span>
                <div
                  className="w-full max-w-[36px] bg-blue-500 hover:bg-blue-600 rounded-t transition-all"
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] font-mono text-zinc-400">
                  {d.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entry Tree Focus Breakdown (Direct vs Aggregate Drill-down) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-pretty">
            <PieChart className="w-4 h-4 text-purple-500" aria-hidden="true" />
            <span>条目投入下钻分布</span>
          </h2>
          <span className="text-[11px] text-zinc-400">
            包含直接投入与聚合投入对比
          </span>
        </div>

        <div className="space-y-2">
          {rootEntries.map((root) => {
            const isExpanded = expandedRootId === root.id;
            const children = entries.filter((e) => e.parentId === root.id);

            return (
              <div
                key={root.id}
                className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden text-xs"
              >
                <div
                  onClick={() =>
                    setExpandedRootId(isExpanded ? null : root.id)
                  }
                  className="p-3 bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2 font-medium">
                    {children.length > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                      )
                    ) : (
                      <span className="w-4 h-4" />
                    )}
                    <span>{root.title}</span>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums">
                    <span className="text-zinc-500">
                      直接: {(root.directFocusSeconds / 3600).toFixed(1)}h
                    </span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                      聚合: {(root.aggregateFocusSeconds / 3600).toFixed(1)}h
                    </span>
                  </div>
                </div>

                {isExpanded && children.length > 0 && (
                  <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 space-y-2 pl-8">
                    {children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between text-zinc-600 dark:text-zinc-400"
                      >
                        <span>• {child.title}</span>
                        <div className="flex items-center gap-4 font-mono text-[10px] tabular-nums">
                          <span>直接: {(child.directFocusSeconds / 3600).toFixed(1)}h</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            聚合: {(child.aggregateFocusSeconds / 3600).toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
