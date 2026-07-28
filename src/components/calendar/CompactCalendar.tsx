import { ArrowRight } from "lucide-react";
import type { Entry, FocusSession, ScheduleBlock } from "@/lib/domain/types";
import { rangeFocusesForDay, rangeSchedulesForDay, scheduleAccentColor, type CalendarDay } from "./calendar-utils";

type CompactCalendarProps = {
  weekDays: CalendarDay[];
  scheduleBlocks: ScheduleBlock[];
  focusSessions: FocusSession[];
  entries: Entry[];
  onScheduleClick: (schedule: ScheduleBlock) => void;
  onFocusClick: (entryId: string | null) => void;
};

const formatTime = (value: number) => new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
}).format(value);

export function CompactCalendar({ weekDays, scheduleBlocks, focusSessions, entries, onScheduleClick, onFocusClick }: CompactCalendarProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-[840px] grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const daySchedules = rangeSchedulesForDay(day.date, scheduleBlocks);
          const dayFocuses = rangeFocusesForDay(day.date, focusSessions);
          return (
            <div key={day.date} className="min-h-[340px] space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex items-start justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">{day.dayName}</div>
                  <div className="font-mono text-[10px] text-zinc-400">{day.date.slice(5)}</div>
                </div>
                <div className="flex flex-col items-end gap-1 text-[10px] font-medium">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">日程 {daySchedules.length}</span>
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">专注 {dayFocuses.length}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">日程轨道</div>
                {daySchedules.length > 0 ? daySchedules.map(({ item: schedule, range }) => (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => onScheduleClick(schedule)}
                    aria-label={`打开日程：${schedule.title}，${formatTime(range.startMs)} 至 ${formatTime(range.endMs)}`}
                    style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(schedule.colorKey) }}
                    className="group flex w-full flex-col rounded border border-blue-200 bg-blue-50/80 px-2 py-1.5 text-left text-xs text-blue-900 transition-colors hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-1 leading-tight">
                      <span className="truncate font-medium">{schedule.title}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-blue-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] tabular-nums opacity-80">{formatTime(range.startMs)}–{formatTime(range.endMs)}</div>
                  </button>
                )) : <div className="rounded border border-dashed border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-800">暂无日程</div>}
              </div>

              <div className="space-y-1.5 border-t border-zinc-200/60 pt-2 dark:border-zinc-800">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">专注事实轨道</div>
                {dayFocuses.length > 0 ? dayFocuses.map(({ item: focus, range }) => {
                  const entryId = focus.segments[0]?.entryId ?? null;
                  const title = entryId ? entries.find((entry) => entry.id === entryId)?.title ?? "未关联专注" : "未关联专注";
                  return (
                    <button
                      key={focus.id}
                      type="button"
                      onClick={() => onFocusClick(entryId)}
                      aria-label={`打开专注：${title}，${formatTime(range.startMs)} 至 ${focus.endedAt ? formatTime(range.endMs) : "进行中"}`}
                      className="group flex w-full flex-col rounded border border-purple-200 bg-purple-50/80 px-2 py-1.5 text-left text-xs text-purple-900 transition-colors hover:border-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-1 leading-tight">
                        <span className="truncate font-medium">{title}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] tabular-nums opacity-80">{formatTime(range.startMs)}–{focus.endedAt ? formatTime(range.endMs) : "进行中"}</div>
                      {focus.segments.length > 1 && <div className="mt-0.5 text-[9px] font-semibold text-purple-600 dark:text-purple-400">[{focus.segments.length} 个拆分片段]</div>}
                    </button>
                  );
                }) : <div className="rounded border border-dashed border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-800">暂无专注记录</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
