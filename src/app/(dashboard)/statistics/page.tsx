"use client";

import React, { useEffect, useState, useRef } from "react";
import { useData } from "@/context/MockContext";
import type { StatisticsPayload } from "@/lib/domain/types";
import {
  BarChart3,
  PieChart,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Activity,
  CalendarDays,
  Sparkles,
} from "lucide-react";

type Scale = "day" | "week" | "month";

/**
 * 交互式 SVG 折线/面积图组件 (用于月视图)
 */
function MonthLineChart({
  daily,
}: {
  daily: Array<{ date: string; seconds: number }>;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPoints = daily.length;
  const maxSeconds = Math.max(...daily.map((d) => d.seconds), 3600); // 至少 1 小时基准线

  // 计算坐标点 (viewBox 800 x 140)
  const svgWidth = 800;
  const svgHeight = 140;
  const paddingTop = 20;
  const paddingBottom = 25;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const points = daily.map((item, index) => {
    const x = (index / (totalPoints - 1)) * svgWidth;
    const ratio = Math.min(1, item.seconds / maxSeconds);
    const y = svgHeight - paddingBottom - ratio * chartHeight;
    return { x, y, item, index };
  });

  // 构建折线 path
  const linePathD = points.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, "");

  // 构建渐变填充 Path
  const areaPathD = `${linePathD} L ${svgWidth},${svgHeight - paddingBottom} L 0,${
    svgHeight - paddingBottom
  } Z`;

  // 处理鼠标在 SVG 上的悬浮定位
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, offsetX / rect.width));
    const closestIdx = Math.round(pct * (totalPoints - 1));
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // 抽样 X 轴刻度 (对于 30 天，只显示第 1、6、11、16、21、26、30 天等)
  const sampledLabels = points.filter(
    (_, idx) => idx === 0 || idx % 5 === 0 || idx === totalPoints - 1
  );

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="space-y-3">
      {/* 顶部悬浮数据提示条 */}
      <div className="flex items-center justify-between text-xs h-6 px-1">
        <div className="flex items-center gap-2">
          {activePoint ? (
            <div className="flex items-center gap-2 font-medium animate-fadeIn">
              <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {activePoint.item.date}
              </span>
              <span className="text-zinc-600 dark:text-zinc-300">
                专注：
                <strong className="font-mono text-blue-600 dark:text-blue-400">
                  {(activePoint.item.seconds / 3600).toFixed(1)} 小时
                </strong>
              </span>
            </div>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
              悬浮滑动查看每日精确专注时间
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-400">
          月度最高单日：
          <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
            {(maxSeconds / 3600).toFixed(1)}h
          </span>
        </div>
      </div>

      {/* 折线图绘制容器 */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-44 w-full cursor-crosshair rounded-xl border border-zinc-200/80 bg-gradient-to-b from-blue-50/20 via-zinc-50/50 to-white p-3 dark:border-zinc-800 dark:from-blue-950/10 dark:via-zinc-900/40 dark:to-zinc-950"
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="month-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 网格参考横线 */}
          <line
            x1="0"
            y1={paddingTop}
            x2={svgWidth}
            y2={paddingTop}
            className="stroke-zinc-200/50 dark:stroke-zinc-800"
            strokeDasharray="4 4"
          />
          <line
            x1="0"
            y1={svgHeight - paddingBottom}
            x2={svgWidth}
            y2={svgHeight - paddingBottom}
            className="stroke-zinc-200 dark:stroke-zinc-800"
          />

          {/* 填充面积 */}
          <path d={areaPathD} fill="url(#month-area-gradient)" />

          {/* 折线 */}
          <path
            d={linePathD}
            fill="none"
            className="stroke-blue-500 dark:stroke-blue-400"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 有数值的数据点小红点/蓝点提示 */}
          {points.map(
            (pt) =>
              pt.item.seconds > 0 && (
                <circle
                  key={pt.item.date}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  className="fill-blue-600 stroke-white stroke-2 dark:fill-blue-400 dark:stroke-zinc-950"
                />
              )
          )}

          {/* 悬浮时的 Crosshair 竖线与聚焦大圆点 */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={svgHeight - paddingBottom}
                className="stroke-blue-500/60 dark:stroke-blue-400/60"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                className="fill-blue-600 stroke-white stroke-2 shadow-lg dark:fill-blue-400 dark:stroke-zinc-900"
              />
            </g>
          )}
        </svg>

        {/* X 轴抽样刻度 */}
        <div className="relative mt-1 flex justify-between text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
          {sampledLabels.map((pt) => (
            <span key={pt.item.date}>{pt.item.date.slice(5)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const { api, data, version } = useData();
  const [scale, setScale] = useState<Scale>("week");
  const [expandedRootId, setExpandedRootId] = useState<string | null>("entry_ics2");
  const [statisticsCache, setStatisticsCache] = useState<
    Partial<Record<string, StatisticsPayload>>
  >({});

  const cacheKey = `${version}:${scale}`;
  const stats = statisticsCache[cacheKey] ?? (scale === "week" ? data.statistics.week : undefined);

  useEffect(() => {
    if (stats) return;
    let cancelled = false;
    void api.getStatisticsPayload(scale).then((payload) => {
      if (!cancelled) {
        setStatisticsCache((current) => ({ ...current, [cacheKey]: payload }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, cacheKey, scale, stats]);

  if (!stats) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-zinc-500">
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        <span>正在加载统计数据…</span>
      </div>
    );
  }

  const entries = data.entries;
  const entryStatsById = new Map(
    stats.entryBreakdown.map((item) => [item.entryId, item] as const)
  );
  const totalHours = (stats.totalSeconds / 3600).toFixed(1);
  const unassignedHours = (stats.unassignedSeconds / 3600).toFixed(1);
  const scaleLabel = scale === "day" ? "今日" : scale === "week" ? "本周" : "本月";

  const strongestRoot = stats.roots.reduce<StatisticsPayload["roots"][number] | null>(
    (best, item) => {
      if (!best || item.aggregateSeconds > best.aggregateSeconds) return item;
      return best;
    },
    null
  );
  const strongestEntry = strongestRoot
    ? entries.find((entry) => entry.id === strongestRoot.entryId) || null
    : null;
  const strongestShare =
    stats.totalSeconds > 0 && strongestRoot
      ? (strongestRoot.aggregateSeconds / stats.totalSeconds) * 100
      : 0;
  const rootEntries = entries.filter((entry) => entry.parentId === null);
  const activeDayCount = stats.daily.filter((item) => item.seconds > 0).length;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8 space-y-6">
      {/* 头部状态与时间范围切换 */}
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-pretty text-zinc-900 dark:text-zinc-100">
            时间与投入统计
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            追溯时间去向。清晰区分直接投入与递归聚合投入，防止重复统计。
          </p>
        </div>

        <div
          className="flex shrink-0 items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          role="group"
          aria-label="统计时间范围"
        >
          {(["day", "week", "month"] as const).map((item) => {
            const active = scale === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setScale(item)}
                className={`rounded px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
                aria-pressed={active}
              >
                {item === "day" ? "日视图" : item === "week" ? "周视图" : "月视图"}
              </button>
            );
          })}
        </div>
      </header>

      {/* 概览三卡片 */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3" aria-label="统计概览">
        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>总专注时长（{scaleLabel}）</span>
            <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
          </div>
          <div className="font-mono text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {totalHours} <span className="font-sans text-sm font-normal text-zinc-500">小时</span>
          </div>
          <p className="text-[11px] text-zinc-400">包含所有条目与未关联专注</p>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>未关联专注</span>
            <HelpCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
          </div>
          <div className="font-mono text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {unassignedHours} <span className="font-sans text-sm font-normal text-zinc-500">小时</span>
          </div>
          <p className="text-[11px] text-zinc-400">未分配给具体条目的专注记录</p>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>主要投入方向（{scaleLabel}）</span>
            <TrendingUp className="h-4 w-4 text-purple-500" aria-hidden="true" />
          </div>
          <div className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {strongestEntry?.title || "暂无"}
          </div>
          <p className="font-mono text-[11px] tabular-nums text-zinc-400">
            {strongestRoot
              ? `聚合投入：${(strongestRoot.aggregateSeconds / 3600).toFixed(1)} 小时 (${strongestShare.toFixed(0)}%)`
              : "暂无可统计投入"}
          </p>
        </div>
      </section>

      {/* 专注趋势部分 */}
      <section
        className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
        aria-labelledby="statistics-trend"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2
            id="statistics-trend"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-800 text-pretty dark:text-zinc-200"
          >
            {scale === "month" ? (
              <Activity className="h-4 w-4 text-blue-500" aria-hidden="true" />
            ) : (
              <BarChart3 className="h-4 w-4 text-blue-500" aria-hidden="true" />
            )}
            <span>{scaleLabel}专注趋势</span>
          </h2>

          {scale === "month" && (
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
                本月活跃：<strong className="text-blue-600 dark:text-blue-400">{activeDayCount}</strong> / {stats.daily.length} 天
              </span>
            </div>
          )}
        </div>

        {/* 图表展示区：月视图采用折线图，日/周视图保持柱状图 */}
        {scale === "month" ? (
          <MonthLineChart daily={stats.daily} />
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid h-40 items-end gap-2 rounded-lg border border-zinc-200/60 bg-zinc-50 px-2 pt-6 dark:border-zinc-800 dark:bg-zinc-800/30"
              style={{
                gridTemplateColumns: `repeat(${stats.daily.length}, minmax(0, 1fr))`,
                minWidth: `${Math.max(7, stats.daily.length) * 44}px`,
              }}
            >
              {stats.daily.map((item) => {
                const hours = (item.seconds / 3600).toFixed(1);
                const heightPct = Math.min(100, Math.max(10, (item.seconds / 14400) * 100));
                return (
                  <div key={item.date} className="group flex h-full flex-col items-center justify-end gap-2">
                    <span className="font-mono text-[10px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      {hours}h
                    </span>
                    <div
                      className="w-full max-w-[36px] rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                      style={{ height: `${heightPct}%` }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[10px] text-zinc-400">
                      {scale === "day" ? item.date : item.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 下钻分布 */}
      <section
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
        aria-labelledby="statistics-breakdown"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2
            id="statistics-breakdown"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-800 text-pretty dark:text-zinc-200"
          >
            <PieChart className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <span>条目投入下钻分布</span>
          </h2>
          <span className="text-[11px] text-zinc-400">包含直接投入与聚合投入对比</span>
        </div>

        <div className="space-y-2">
          {rootEntries.map((root) => {
            const isExpanded = expandedRootId === root.id;
            const children = entries.filter((entry) => entry.parentId === root.id);
            const rootStats = entryStatsById.get(root.id);
            const panelId = `root-stats-${root.id}`;
            const buttonId = `${panelId}-button`;
            const content = (
              <>
                {children.length > 0 ? (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                  )
                ) : (
                  <span className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="min-w-0 truncate">{root.title}</span>
              </>
            );

            return (
              <div
                key={root.id}
                className="overflow-hidden rounded-lg border border-zinc-200 text-xs dark:border-zinc-800"
              >
                {children.length > 0 ? (
                  <button
                    id={buttonId}
                    type="button"
                    onClick={() => setExpandedRootId(isExpanded ? null : root.id)}
                    className="flex w-full items-center justify-between gap-3 bg-zinc-50/70 p-3 text-left font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-zinc-800/40 dark:hover:bg-zinc-800"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                  >
                    <span className="flex min-w-0 items-center gap-2">{content}</span>
                    <span className="flex shrink-0 items-center gap-4 font-mono text-[11px] tabular-nums">
                      <span className="text-zinc-500">
                        直接: {((rootStats?.directSeconds ?? 0) / 3600).toFixed(1)}h
                      </span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        聚合: {((rootStats?.aggregateSeconds ?? 0) / 3600).toFixed(1)}h
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-3 bg-zinc-50/70 p-3 font-medium dark:bg-zinc-800/40">
                    <span className="flex min-w-0 items-center gap-2">{content}</span>
                    <span className="flex shrink-0 items-center gap-4 font-mono text-[11px] tabular-nums">
                      <span className="text-zinc-500">
                        直接: {((rootStats?.directSeconds ?? 0) / 3600).toFixed(1)}h
                      </span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        聚合: {((rootStats?.aggregateSeconds ?? 0) / 3600).toFixed(1)}h
                      </span>
                    </span>
                  </div>
                )}

                {isExpanded && children.length > 0 && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="space-y-2 border-t border-zinc-100 bg-white p-3 pl-8 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {children.map((child) => (
                      <ChildStatsRow
                        key={child.id}
                        title={child.title}
                        stats={entryStatsById.get(child.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ChildStatsRow({
  title,
  stats,
}: {
  title: string;
  stats?: { directSeconds: number; aggregateSeconds: number } | undefined;
}) {
  return (
    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
      <span className="min-w-0 flex-1 truncate">• {title}</span>
      <div className="flex shrink-0 items-center gap-4 font-mono text-[10px] tabular-nums">
        <span>直接: {((stats?.directSeconds ?? 0) / 3600).toFixed(1)}h</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          聚合: {((stats?.aggregateSeconds ?? 0) / 3600).toFixed(1)}h
        </span>
      </div>
    </div>
  );
}
