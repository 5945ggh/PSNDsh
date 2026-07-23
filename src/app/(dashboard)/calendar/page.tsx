"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/context/MockContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { IcsImportModal } from "@/components/calendar/IcsImportModal";
import { ScheduleEditorModal } from "@/components/calendar/ScheduleEditorModal";
import { CalendarPayload, ScheduleBlock, ScheduleBlockInput } from "@/types/mock";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Plus,
  Clock,
  BookOpen,
  LayoutGrid,
  ListFilter,
  Eye,
  ArrowRight,
  X,
  Trash2,
  Pencil,
} from "lucide-react";

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";
const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const shanghaiTimePartsFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: SHANGHAI_TIME_ZONE,
});

const subscribeToMobileViewport = (onChange: () => void) => {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
};

const getMobileViewportSnapshot = () =>
  window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;

const getServerViewportSnapshot = () => false;

const getShanghaiDecimalHour = (value: Date) => {
  const parts = shanghaiTimePartsFormatter.formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour + minute / 60;
};

const scheduleAccentColor = (colorKey: string | null) => {
  const colors: Record<string, string> = {
    blue: "#2563eb",
    green: "#059669",
    amber: "#d97706",
    rose: "#e11d48",
  };
  return colors[colorKey ?? "blue"] ?? colors.blue;
};

const currentShanghaiWeekStart = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const current = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const weekday = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() - weekday + 1);
  return current.toISOString().slice(0, 10);
};

const shiftDateKey = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const weekDaysFor = (weekStart: string) =>
  Array.from({ length: 7 }, (_, index) => {
    return {
      date: shiftDateKey(weekStart, index),
      dayName: `周${["一", "二", "三", "四", "五", "六", "日"][index]}`,
    };
  });

export default function CalendarPage() {
  const router = useRouter();
  const { api, data, mutate, version } = useData();
  const { setIsManualModalOpen } = useFocusTimer();

  const [weekStart, setWeekStart] = useState(currentShanghaiWeekStart);
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const scheduleBlocks = calendar?.scheduleBlocks ?? [];
  const focusSessions = calendar?.focusSessions ?? [];
  const entries = data.entries;
  const getEntryById = (id: string) => entries.find((entry) => entry.id === id);

  const [isIcsOpen, setIsIcsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "compact" | "day">("grid");
  const [hasChosenViewMode, setHasChosenViewMode] = useState(false);
  const [trackFilter, setTrackFilter] = useState<"both" | "schedule" | "focus">("both");
  const weekDays = useMemo(() => weekDaysFor(weekStart), [weekStart]);
  const [selectedDay, setSelectedDay] = useState(currentShanghaiWeekStart);
  const [activeScheduleModal, setActiveScheduleModal] = useState<ScheduleBlock | null>(null);
  const [scheduleEditor, setScheduleEditor] = useState<ScheduleBlock | "new" | null>(null);
  const isMobileViewport = useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getServerViewportSnapshot
  );
  const displayedViewMode = isMobileViewport && !hasChosenViewMode ? "day" : viewMode;
  const selectViewMode = (mode: "grid" | "compact" | "day") => {
    setViewMode(mode);
    setHasChosenViewMode(true);
  };

  const refreshCalendar = useCallback(async () => {
    setIsCalendarLoading(true);
    setCalendarError(null);
    try {
      const nextWeekStart = weekStart;
      setCalendar(await api.getCalendarPayload(
        `${nextWeekStart}T00:00:00+08:00`,
        `${shiftDateKey(nextWeekStart, 7)}T00:00:00+08:00`
      ));
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "日历数据加载失败");
    } finally {
      setIsCalendarLoading(false);
    }
  }, [api, weekStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshCalendar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshCalendar, version]);

  const changeWeek = (nextWeekStart: string) => {
    setWeekStart(nextWeekStart);
    setSelectedDay(nextWeekStart);
  };
  const isCurrentWeek = weekStart === currentShanghaiWeekStart();

  const selectedDayIndex = Math.max(0, weekDays.findIndex((day) => day.date === selectedDay));
  const selectedDayMeta = weekDays[selectedDayIndex];
  const formatShanghaiTime = (value: number) =>
    new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: SHANGHAI_TIME_ZONE,
    }).format(value);
  const overlapRange = (date: string, startedAt: string, endedAt: string) => {
    const dayStartMs = Date.parse(`${date}T00:00:00+08:00`);
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(endedAt).getTime();
    const overlapStart = Math.max(startMs, dayStartMs);
    const overlapEnd = Math.min(endMs, dayEndMs);
    if (overlapEnd <= overlapStart) return null;
    return { startMs: overlapStart, endMs: overlapEnd };
  };
  const selectedDaySchedules = scheduleBlocks.filter((block) =>
    overlapRange(selectedDay, block.startedAt, block.endedAt)
  );
  const selectedDayFocuses = focusSessions.filter((session) => {
    const sessionEnd = session.endedAt || new Date().toISOString();
    return overlapRange(selectedDay, session.startedAt, sessionEnd);
  });

  // Full-day desktop timeline keeps both halves of a cross-midnight session visible.
  const startHourRange = 0;
  const totalHoursCount = 24;
  const hourRowHeight = 56;
  const gridTotalHeight = totalHoursCount * hourRowHeight;

  const hoursList = Array.from({ length: totalHoursCount }, (_, i) => i + startHourRange);

  const computeTimePosition = (startedAt: string, endedAt: string | null) => {
    const sDate = new Date(startedAt);
    const eDate = endedAt ? new Date(endedAt) : new Date(sDate.getTime() + 60 * 60 * 1000);

    const sHour = getShanghaiDecimalHour(sDate);
    const rawEndHour = getShanghaiDecimalHour(eDate);
    const eHour =
      eDate.getTime() > sDate.getTime() && rawEndHour <= sHour
        ? rawEndHour + 24
        : rawEndHour;

    const clampedSHour = Math.max(startHourRange, Math.min(startHourRange + totalHoursCount, sHour));
    const clampedEHour = Math.max(clampedSHour + 0.5, Math.min(startHourRange + totalHoursCount, eHour));

    const top = (clampedSHour - startHourRange) * hourRowHeight;
    const height = Math.max(28, (clampedEHour - clampedSHour) * hourRowHeight);

    return { top, height };
  };

  const getPopoverPositionClass = (topPx: number, dayIdx: number) => {
    const verticalClass = topPx < 90 ? "top-full mt-2" : "bottom-full mb-2";
    let horizontalClass = "left-1/2 -translate-x-1/2";
    if (dayIdx <= 1) {
      horizontalClass = "left-0 translate-x-0";
    } else if (dayIdx >= 5) {
      horizontalClass = "right-0 translate-x-0";
    }
    return `${verticalClass} ${horizontalClass}`;
  };

  const handleScheduleClick = (sch: ScheduleBlock) => {
    setActiveScheduleModal(sch);
  };

  const handleFocusClick = (entryId: string | null) => {
    if (entryId) {
      router.push(`/entries/${entryId}`);
    } else {
      router.push("/plan");
    }
  };

  const saveSchedule = async (input: ScheduleBlockInput) => {
    if (scheduleEditor === "new") {
      await mutate(() => api.addScheduleBlock(input), {
        refresh: false,
        update: (snapshot, schedule) => ({
          ...snapshot,
          scheduleBlocks: [...snapshot.scheduleBlocks, schedule],
        }),
      });
    } else if (scheduleEditor) {
      await mutate(() => api.updateScheduleBlock(scheduleEditor.id, input), {
        refresh: false,
        update: (snapshot, schedule) => ({
          ...snapshot,
          scheduleBlocks: snapshot.scheduleBlocks.map((item) => item.id === schedule.id ? schedule : item),
        }),
      });
    }
    await refreshCalendar();
  };

  const deleteSchedule = async (schedule: ScheduleBlock) => {
    if (!window.confirm(`确定删除“${schedule.title}”吗？`)) return;
    await mutate(() => api.deleteScheduleBlock(schedule.id), {
      refresh: false,
      update: (snapshot) => ({
        ...snapshot,
        scheduleBlocks: snapshot.scheduleBlocks.filter((item) => item.id !== schedule.id),
      }),
    });
    setActiveScheduleModal(null);
    await refreshCalendar();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Fixed Header Banner */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-pretty">周历与时间面板</h1>
          <p className="text-xs text-zinc-500 mt-1">
            按双轨道排布课程日程与专注记录，点击任意日程或专注块即可跳转至对应条目详情。
          </p>
        </div>

        {/* Fixed Control Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs bg-zinc-50 dark:bg-zinc-800" aria-label="周导航">
            <button
              onClick={() => changeWeek(shiftDateKey(weekStart, -7))}
              aria-label="上一周"
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            {isCurrentWeek ? (
              <span
                aria-current="date"
                className="px-2 py-1.5 font-medium text-zinc-500 dark:text-zinc-400 select-none"
              >
                本周
              </span>
            ) : (
              <button
                onClick={() => changeWeek(currentShanghaiWeekStart())}
                className="px-2 py-1.5 font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                返回本周
              </button>
            )}
            <button
              onClick={() => changeWeek(shiftDateKey(weekStart, 7))}
              aria-label="下一周"
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs bg-zinc-50 dark:bg-zinc-800">
            <button
              onClick={() => selectViewMode("grid")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                displayedViewMode === "grid"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>时间轴网格</span>
            </button>

            <button
              onClick={() => selectViewMode("compact")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                displayedViewMode === "compact"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>紧凑看板</span>
            </button>

            <button
              onClick={() => selectViewMode("day")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                displayedViewMode === "day"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>单日纵览</span>
            </button>
          </div>

          {/* Track Filter */}
          <div className="flex items-center gap-1 text-xs bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <Eye className="w-3.5 h-3.5 text-zinc-400 ml-1" aria-hidden="true" />
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value as "both" | "schedule" | "focus")}
              aria-label="筛选显示轨道"
              className="bg-transparent font-medium outline-none text-zinc-700 dark:text-zinc-300 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <option value="both">双轨呈现 (日程 + 专注)</option>
              <option value="schedule">仅看日程轨道</option>
              <option value="focus">仅看专注轨道</option>
            </select>
          </div>

          <button
            onClick={() => setIsIcsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>导入日程表</span>
          </button>

          <button
            onClick={() => setScheduleEditor("new")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>新增日程</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-sm hover:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>补录专注</span>
          </button>
        </div>
      </div>

      <div aria-live="polite" className="text-xs text-zinc-500">
        {isCalendarLoading
          ? "正在加载本周日程与专注记录..."
          : calendarError
            ? `日历数据加载失败：${calendarError}`
            : `${weekStart} 至 ${weekDays[6]?.date}，日程与专注分别独立呈现`}
      </div>

      {/* Track Legend Notice */}
      <div className="flex items-center justify-between bg-zinc-100/70 dark:bg-zinc-800/40 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 dark:bg-blue-950 dark:border-blue-800 inline-block" aria-hidden="true" />
            <span>课程日程轨道 (点击跳转)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300 dark:bg-purple-950 dark:border-purple-800 inline-block" aria-hidden="true" />
            <span>专注事实轨道 (点击跳转)</span>
          </span>
        </div>
        <span className="text-[11px] text-zinc-400 hidden md:block">
          提示：点击任意日程块或专注块，即可直接跳转至对应条目的详情页面
        </span>
      </div>

      {/* 1. DETAILED HOURLY GRID VIEW WITH CLICK JUMP */}
      {displayedViewMode === "grid" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm overflow-x-auto">
          <div className="min-w-[900px] flex">
            {/* Left Y-axis Hour Labels */}
            <div className="w-16 shrink-0 border-r border-zinc-200 dark:border-zinc-800 pr-2 pt-9 space-y-0 text-right select-none">
              {hoursList.map((h) => (
                <div
                  key={h}
                  className="font-mono text-[11px] text-zinc-400 tabular-nums flex items-start justify-end"
                  style={{ height: `${hourRowHeight}px` }}
                >
                  <span>{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>

            {/* 7 Days Columns */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-zinc-200 dark:divide-zinc-800 relative">
              {/* Grid Background Horizontal Lines */}
              <div className="absolute inset-0 pt-9 pointer-events-none">
                {hoursList.map((h) => (
                  <div
                    key={h}
                    className="border-b border-zinc-100 dark:border-zinc-800/60"
                    style={{ height: `${hourRowHeight}px` }}
                  />
                ))}
              </div>

              {/* Day Headers & Column Content Area */}
              {weekDays.map((wd, dayIdx) => {
                const daySchedules = scheduleBlocks.flatMap((schedule) => {
                  const range = overlapRange(wd.date, schedule.startedAt, schedule.endedAt);
                  return range ? [{ schedule, range }] : [];
                });
                const dayFocuses = focusSessions.flatMap((focus) => {
                  const range = overlapRange(
                    wd.date,
                    focus.startedAt,
                    focus.endedAt || new Date().toISOString()
                  );
                  return range ? [{ focus, range }] : [];
                });

                return (
                  <div key={wd.date} data-testid={`calendar-day-${wd.date}`} className="flex flex-col relative min-w-0">
                    {/* Header */}
                    <div className="text-center pb-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 sticky top-0">
                      <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                        {wd.dayName}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {wd.date.slice(5)}
                      </div>
                    </div>

                    {/* Column Content Area */}
                    <div
                      className="relative flex-1"
                      style={{ height: `${gridTotalHeight}px` }}
                    >
                      <div className="absolute inset-0 flex">
                        {/* Sub-column A: Schedule Track */}
                        {(trackFilter === "both" || trackFilter === "schedule") && (
                          <div
                            onDoubleClick={(event) => {
                              if (event.target === event.currentTarget) {
                                setSelectedDay(wd.date);
                                setScheduleEditor("new");
                              }
                            }}
                            className={`relative border-r border-dashed border-zinc-200/50 dark:border-zinc-800/40 ${
                              trackFilter === "both" ? "w-1/2" : "w-full"
                            }`}
                          >
                            {daySchedules.map(({ schedule: sch, range }) => {
                              const pos = computeTimePosition(
                                new Date(range.startMs).toISOString(),
                                new Date(range.endMs).toISOString()
                              );
                              const popoverPosClass = getPopoverPositionClass(pos.top, dayIdx);

                              return (
                                <div
                                  key={sch.id}
                                  onClick={() => handleScheduleClick(sch)}
                                  style={{ top: `${pos.top}px`, height: `${pos.height}px` }}
                                  className="absolute inset-x-0.5 group/block z-10 hover:z-50 cursor-pointer"
                                >
                                  {/* Visual Block Card */}
                                  <div style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(sch.colorKey) }} className="w-full h-full p-1.5 rounded bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-[11px] overflow-hidden shadow-2xs hover:border-blue-400 hover:shadow-md transition-all">
                                    <div className="font-semibold truncate leading-tight flex items-center justify-between">
                                      <span className="truncate">{sch.title}</span>
                                      <ArrowRight className="w-3 h-3 opacity-0 group-hover/block:opacity-100 shrink-0 text-blue-500" />
                                    </div>
                                    <div className="text-[9px] font-mono opacity-80 tabular-nums">
                                      {formatShanghaiTime(range.startMs)}–{formatShanghaiTime(range.endMs)}
                                    </div>
                                  </div>

                                  {/* Smart Positioned Hover Popover Detail */}
                                  <div
                                    className={`absolute hidden group-hover/block:block group-focus-within/block:block z-50 w-64 p-4 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl text-sm space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${popoverPosClass}`}
                                  >
                                    <div className="font-semibold text-zinc-200 border-b border-zinc-700/60 pb-2 flex items-center justify-between gap-2">
                                      <span className="truncate">{sch.title}</span>
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-900 text-blue-200">
                                        日程 (点击跳转)
                                      </span>
                                    </div>
                                    <div className="space-y-1.5 text-xs font-mono text-zinc-300 tabular-nums">
                                      <div>时间：{formatShanghaiTime(range.startMs)} – {formatShanghaiTime(range.endMs)}</div>
                                      {sch.location && <div>地点：{sch.location}</div>}
                                      {sch.recurrenceLabel && (
                                        <div className="text-[10px] text-zinc-400">重复：{sch.recurrenceLabel}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Sub-column B: Focus Track */}
                        {(trackFilter === "both" || trackFilter === "focus") && (
                          <div
                            className={`relative ${
                              trackFilter === "both" ? "w-1/2" : "w-full"
                            }`}
                          >
                            {dayFocuses.map(({ focus: foc, range }) => {
                              const pos = computeTimePosition(
                                new Date(range.startMs).toISOString(),
                                new Date(range.endMs).toISOString()
                              );
                              const seg = foc.segments[0];
                              const entry = seg?.entryId ? getEntryById(seg.entryId) : null;
                              const entryTitle = entry ? entry.title : "未关联专注";
                              const popoverPosClass = getPopoverPositionClass(pos.top, dayIdx);

                              return (
                                <div
                                  key={foc.id}
                                  onClick={() => handleFocusClick(seg?.entryId || null)}
                                  style={{ top: `${pos.top}px`, height: `${pos.height}px` }}
                                  className="absolute inset-x-0.5 group/block z-10 hover:z-50 cursor-pointer"
                                >
                                  {/* Visual Block Card */}
                                  <div className="w-full h-full p-1.5 rounded bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-[11px] overflow-hidden shadow-2xs hover:border-purple-400 hover:shadow-md transition-all">
                                    <div className="font-semibold truncate leading-tight flex items-center justify-between">
                                      <span className="truncate">{entryTitle}</span>
                                      <ArrowRight className="w-3 h-3 opacity-0 group-hover/block:opacity-100 shrink-0 text-purple-500" />
                                    </div>
                                    <div className="text-[9px] font-mono opacity-80 tabular-nums">
                                      {formatShanghaiTime(range.startMs)}–{foc.endedAt ? formatShanghaiTime(range.endMs) : "进行中"}
                                    </div>
                                    {foc.segments.length > 1 && (
                                      <div className="text-[9px] text-purple-600 dark:text-purple-300 font-semibold truncate">
                                        [{foc.segments.length}片段]
                                      </div>
                                    )}
                                  </div>

                                  {/* Smart Positioned Hover Popover Detail */}
                                  <div
                                    className={`absolute hidden group-hover/block:block group-focus-within/block:block z-50 w-64 p-4 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl text-sm space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${popoverPosClass}`}
                                  >
                                    <div className="font-semibold text-zinc-200 border-b border-zinc-700/60 pb-2 flex items-center justify-between gap-2">
                                      <span className="truncate">{entryTitle}</span>
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-900 text-purple-200">
                                        专注 (点击跳转)
                                      </span>
                                    </div>
                                    <div className="space-y-1.5 text-xs font-mono text-zinc-300 tabular-nums">
                                      <div>时间：{formatShanghaiTime(range.startMs)} – {foc.endedAt ? formatShanghaiTime(range.endMs) : "进行中"}</div>
                                      <div>类型：{foc.captureMode === "timer" ? "实时计时" : "手动补录"}</div>
                                      {foc.outcome && (
                                        <div className="text-[10px] text-emerald-400">成果：{foc.outcome}</div>
                                      )}
                                      {foc.note && (
                                        <div className="text-[10px] text-zinc-400">备注：{foc.note}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. COMPACT CARD GRID VIEW */}
      {displayedViewMode === "compact" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm overflow-x-auto">
          <div className="min-w-[800px] grid grid-cols-7 gap-2">
            {weekDays.map((wd) => {
              const daySchedules = scheduleBlocks.flatMap((schedule) => {
                const range = overlapRange(wd.date, schedule.startedAt, schedule.endedAt);
                return range ? [{ schedule, range }] : [];
              });
              const dayFocuses = focusSessions.flatMap((focus) => {
                const range = overlapRange(
                  wd.date,
                  focus.startedAt,
                  focus.endedAt || new Date().toISOString()
                );
                return range ? [{ focus, range }] : [];
              });

              return (
                <div
                  key={wd.date}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3 min-h-[360px]"
                >
                  <div className="text-center border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                      {wd.dayName}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {wd.date.slice(5)}
                    </div>
                  </div>

                  {/* Schedule Track */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-semibold uppercase text-blue-600 dark:text-blue-400 block">
                      日程轨道
                    </span>
                    {daySchedules.length > 0 ? (
                      daySchedules.map(({ schedule: sch, range }) => (
                        <div
                          key={sch.id}
                          onClick={() => handleScheduleClick(sch)}
                          style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(sch.colorKey) }}
                          className="p-2 rounded border text-xs space-y-0.5 bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 cursor-pointer hover:border-blue-400 transition-colors group"
                        >
                          <div className="font-medium truncate flex items-center justify-between">
                            <span className="truncate">{sch.title}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 text-blue-500" />
                          </div>
                          <div className="text-[10px] font-mono opacity-80 tabular-nums">
                            {formatShanghaiTime(range.startMs)}–{formatShanghaiTime(range.endMs)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] text-zinc-400 italic py-1">无预排日程</div>
                    )}
                  </div>

                  {/* Focus Track */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-[9px] font-semibold uppercase text-purple-600 dark:text-purple-400 block">
                      专注事实轨道
                    </span>
                    {dayFocuses.length > 0 ? (
                      dayFocuses.map(({ focus: foc, range }) => {
                        const seg = foc.segments[0];
                        const entryTitle = seg?.entryId
                          ? getEntryById(seg.entryId)?.title
                          : "未关联专注";
                        return (
                          <div
                            key={foc.id}
                            onClick={() => handleFocusClick(seg?.entryId || null)}
                            className="p-2 rounded border text-xs space-y-0.5 bg-purple-50/80 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 cursor-pointer hover:border-purple-400 transition-colors group"
                          >
                            <div className="font-medium truncate flex items-center justify-between">
                              <span className="truncate">{entryTitle}</span>
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 text-purple-500" />
                            </div>
                            <div className="text-[10px] font-mono opacity-80 tabular-nums">
                              {formatShanghaiTime(range.startMs)}–{foc.endedAt ? formatShanghaiTime(range.endMs) : "进行中"}
                            </div>
                            {foc.segments.length > 1 && (
                              <div className="text-[9px] text-purple-600 dark:text-purple-400 font-semibold">
                                [{foc.segments.length} 个拆分片段]
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[10px] text-zinc-400 italic py-1">无专注记录</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SINGLE DAY VIEW */}
      {displayedViewMode === "day" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <button
              onClick={() => setSelectedDay(weekDays[Math.max(0, selectedDayIndex - 1)].date)}
              aria-label="前一天"
              className="p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="text-center">
              <span className="font-semibold text-sm">{selectedDayMeta.date} ({selectedDayMeta.dayName})</span>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {selectedDaySchedules.length} 项日程，{selectedDayFocuses.length} 条专注
              </p>
            </div>
            <button
              onClick={() => setSelectedDay(weekDays[Math.min(weekDays.length - 1, selectedDayIndex + 1)].date)}
              aria-label="后一天"
              className="p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {(trackFilter === "both" || trackFilter === "schedule") && (
              <div className="space-y-2">
                <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  <span>课程日程轨道</span>
                </h3>
                <div className="space-y-2">
                  {selectedDaySchedules.length > 0 ? (
                    selectedDaySchedules.map((schedule) => {
                      const range = overlapRange(selectedDay, schedule.startedAt, schedule.endedAt)!;
                      return (
                        <div
                          key={schedule.id}
                          onClick={() => handleScheduleClick(schedule)}
                          style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(schedule.colorKey) }}
                          className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-blue-900 dark:text-blue-200 truncate">
                              {schedule.title}
                            </div>
                            <div className="text-zinc-500 font-mono text-[11px] mt-0.5 tabular-nums">
                              {formatShanghaiTime(range.startMs)} – {formatShanghaiTime(range.endMs)}
                              {schedule.location ? ` • ${schedule.location}` : ""}
                            </div>
                            {schedule.recurrenceLabel && (
                              <div className="text-[10px] text-blue-600 dark:text-blue-300 mt-1">
                                {schedule.recurrenceLabel}
                              </div>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-blue-500 opacity-60 group-hover:opacity-100 shrink-0" />
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40">
                      该日没有匹配的课程日程
                    </div>
                  )}
                </div>
              </div>
            )}

            {(trackFilter === "both" || trackFilter === "focus") && (
              <>
                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <h3 className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>专注轨道片段</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedDayFocuses.length > 0 ? (
                      selectedDayFocuses.map((focus) => {
                        const focusRange = overlapRange(
                          selectedDay,
                          focus.startedAt,
                          focus.endedAt || new Date().toISOString()
                        )!;
                        const segments = focus.segments
                          .map((segment) => {
                            const segmentRange = overlapRange(
                              selectedDay,
                              segment.startedAt,
                              segment.endedAt
                            );
                            if (!segmentRange) return null;
                            const entry = segment.entryId
                              ? getEntryById(segment.entryId)
                              : null;
                            return {
                              id: segment.id,
                              title: entry?.title || "未关联片段",
                              startMs: segmentRange.startMs,
                              endMs: segmentRange.endMs,
                            };
                          })
                          .filter(
                            (segment): segment is {
                              id: string;
                              title: string;
                              startMs: number;
                              endMs: number;
                            } => segment !== null
                          );
                        const focusTitle = focus.segments[0]?.entryId
                          ? getEntryById(focus.segments[0].entryId)?.title || "未关联专注"
                          : "未关联专注";

                        return (
                          <div
                            key={focus.id}
                            onClick={() => handleFocusClick(focus.segments[0]?.entryId || null)}
                            className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer hover:border-purple-400 transition-colors flex flex-col gap-2 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-purple-900 dark:text-purple-200 truncate">
                                  {focusTitle}
                                </div>
                                <div className="text-zinc-500 font-mono text-[11px] mt-0.5 tabular-nums">
                                  {formatShanghaiTime(focusRange.startMs)} – {focus.endedAt ? formatShanghaiTime(focusRange.endMs) : "进行中"}
                                  {focus.captureMode === "manual" ? " • 手动补录" : " • 实时计时"}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-purple-500 opacity-60 group-hover:opacity-100 shrink-0" />
                            </div>

                            {focus.outcome && (
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                成果：{focus.outcome}
                              </div>
                            )}
                            {focus.note && (
                              <div className="text-[11px] text-zinc-500">
                                备注：{focus.note}
                              </div>
                            )}
                            {segments.length > 0 && (
                              <div className="space-y-1 border-t border-purple-200/70 dark:border-purple-900/60 pt-2">
                                {segments.map((segment) => (
                                  <div
                                    key={segment.id}
                                    className="flex items-center justify-between gap-2 text-[10px] text-purple-700 dark:text-purple-300 font-mono tabular-nums"
                                  >
                                    <span className="truncate">{segment.title}</span>
                                    <span className="shrink-0">
                                      {formatShanghaiTime(segment.startMs)} – {formatShanghaiTime(segment.endMs)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40">
                        该日没有匹配的专注记录
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Standalone Schedule Detail Modal (For schedule blocks with no direct entry mapping) */}
      {activeScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sch-modal-title"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" aria-hidden="true" />
                <h2 id="sch-modal-title" className="font-semibold text-base">日程区块详情</h2>
              </div>
              <button
                onClick={() => setActiveScheduleModal(null)}
                aria-label="关闭对话框"
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <span className="text-zinc-400">标题</span>
                <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {activeScheduleModal.title}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                <div>
                  <span className="text-zinc-400">开始时间</span>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {activeScheduleModal.startedAt.slice(0, 10)} {activeScheduleModal.startedAt.slice(11, 16)}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-400">结束时间</span>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {activeScheduleModal.endedAt.slice(11, 16)}
                  </div>
                </div>
              </div>

              {activeScheduleModal.location && (
                <div>
                  <span className="text-zinc-400">地点</span>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {activeScheduleModal.location}
                  </div>
                </div>
              )}

              {activeScheduleModal.recurrenceLabel && (
                <div>
                  <span className="text-zinc-400">重复规则</span>
                  <div className="font-medium text-purple-600 dark:text-purple-400 mt-0.5">
                    {activeScheduleModal.recurrenceLabel}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <button
                  onClick={() => void deleteSchedule(activeScheduleModal)}
                  className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除日程</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setScheduleEditor(activeScheduleModal);
                      setActiveScheduleModal(null);
                    }}
                    className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>编辑日程</span>
                  </button>
                  <button
                    onClick={() => setActiveScheduleModal(null)}
                    className="px-3 py-1.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium"
                  >
                    知道了
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {scheduleEditor && (
        <ScheduleEditorModal
          schedule={scheduleEditor === "new" ? null : scheduleEditor}
          defaultDate={selectedDay}
          onClose={() => setScheduleEditor(null)}
          onSave={saveSchedule}
        />
      )}

      {/* ICS Modal */}
      <IcsImportModal isOpen={isIcsOpen} onClose={() => setIsIcsOpen(false)} />
    </div>
  );
}
