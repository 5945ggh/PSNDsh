import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Entry, FocusSession, ScheduleBlock } from "@/lib/domain/types";
import { overlapRange, rangeFocusesForDay, rangeSchedulesForDay, scheduleAccentColor, type CalendarDay } from "./calendar-utils";
import type { TrackFilter } from "./CalendarToolbar";

type DayOverviewProps = {
  selectedDay: string;
  selectedDayMeta: CalendarDay;
  selectedDayIndex: number;
  weekDays: CalendarDay[];
  scheduleBlocks: ScheduleBlock[];
  focusSessions: FocusSession[];
  entries: Entry[];
  trackFilter: TrackFilter;
  onSelectedDayChange: (date: string) => void;
  onScheduleClick: (schedule: ScheduleBlock) => void;
  onFocusClick: (focus: FocusSession) => void;
};

const formatTime = (value: number) => new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
}).format(value);

export function DayOverview({ selectedDay, selectedDayMeta, selectedDayIndex, weekDays, scheduleBlocks, focusSessions, entries, trackFilter, onSelectedDayChange, onScheduleClick, onFocusClick }: DayOverviewProps) {
  const schedules = rangeSchedulesForDay(selectedDay, scheduleBlocks);
  const focuses = rangeFocusesForDay(selectedDay, focusSessions);
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <button
          onClick={() => onSelectedDayChange(weekDays[Math.max(0, selectedDayIndex - 1)]!.date)}
          aria-label="前一天"
          className="rounded p-1 text-zinc-400 transition-colors hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{selectedDayMeta.date} ({selectedDayMeta.dayName})</div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-medium">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{schedules.length} 项日程</span>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">{focuses.length} 条专注</span>
          </div>
        </div>
        <button
          onClick={() => onSelectedDayChange(weekDays[Math.min(weekDays.length - 1, selectedDayIndex + 1)]!.date)}
          aria-label="后一天"
          className="rounded p-1 text-zinc-400 transition-colors hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4 text-xs">
        {(trackFilter === "both" || trackFilter === "schedule") && (
          <section className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <h3 className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>课程日程轨道</span>
            </h3>
            <div className="space-y-2">
              {schedules.length > 0 ? schedules.map(({ item: schedule, range }) => (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => onScheduleClick(schedule)}
                  style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(schedule.colorKey) }}
                  aria-label={`打开日程：${schedule.title}，${formatTime(range.startMs)} 至 ${formatTime(range.endMs)}${schedule.location ? `，地点 ${schedule.location}` : ""}${schedule.recurrenceLabel ? `，${schedule.recurrenceLabel}` : ""}`}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-blue-900 transition-colors hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{schedule.title}</div>
                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTime(range.startMs)} - {formatTime(range.endMs)}
                      {schedule.location ? ` • ${schedule.location}` : ""}
                    </div>
                    {schedule.recurrenceLabel && <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-300">{schedule.recurrenceLabel}</div>}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-blue-500 opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                </button>
              )) : <div className="rounded-lg border border-dashed border-blue-200 bg-white px-3 py-3 text-zinc-400 dark:border-blue-900/60 dark:bg-blue-950/20">该日没有匹配的课程日程</div>}
            </div>
          </section>
        )}

        {(trackFilter === "both" || trackFilter === "focus") && (
          <section className="space-y-2 rounded-xl border border-purple-100 bg-purple-50/40 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
            <h3 className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>专注轨道片段</span>
            </h3>
            <div className="space-y-2">
              {focuses.length > 0 ? focuses.map(({ item: focus, range }) => {
                const entryId = focus.segments[0]?.entryId ?? null;
                const title = entryId ? entries.find((entry) => entry.id === entryId)?.title ?? "未关联专注" : "未关联专注";
                const segments = focus.segments.flatMap((segment) => {
                  const segmentRange = overlapRange(selectedDay, segment.startedAt, segment.endedAt);
                  return segmentRange ? [{ ...segment, title: segment.entryId ? entries.find((entry) => entry.id === segment.entryId)?.title ?? "未关联片段" : "未关联片段", range: segmentRange }] : [];
                });
                return (
                  <button
                    key={focus.id}
                    type="button"
                    onClick={() => onFocusClick(focus)}
                    aria-label={`打开专注：${title}，${formatTime(range.startMs)} 至 ${focus.endedAt ? formatTime(range.endMs) : "进行中"}，${focus.captureMode === "timer" ? "实时计时" : "手动补录"}${focus.outcome ? `，成果 ${focus.outcome}` : ""}${focus.note ? `，备注 ${focus.note}` : ""}`}
                    className="group flex w-full flex-col gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-left text-purple-900 transition-colors hover:border-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{title}</div>
                        <div className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatTime(range.startMs)} - {focus.endedAt ? formatTime(range.endMs) : "进行中"}
                          {focus.captureMode === "manual" ? " • 手动补录" : " • 实时计时"}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-purple-500 opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                    </div>
                    {focus.outcome && <div className="text-[11px] text-emerald-700 dark:text-emerald-300">成果：{focus.outcome}</div>}
                    {focus.note && <div className="text-[11px] text-zinc-500 dark:text-zinc-400">备注：{focus.note}</div>}
                    {segments.length > 0 && (
                      <div className="space-y-1 border-t border-purple-200/70 pt-2 dark:border-purple-900/60">
                        {segments.map((segment) => (
                          <div key={segment.id} className="flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums text-purple-700 dark:text-purple-300">
                            <span className="truncate">{segment.title}</span>
                            <span className="shrink-0">{formatTime(segment.range.startMs)} - {formatTime(segment.range.endMs)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              }) : <div className="rounded-lg border border-dashed border-purple-200 bg-white px-3 py-3 text-zinc-400 dark:border-purple-900/60 dark:bg-purple-950/20">该日没有匹配的专注记录</div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
