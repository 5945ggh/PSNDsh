import { ArrowRight } from "lucide-react";
import type { Entry, FocusSession, ScheduleBlock } from "@/lib/domain/types";
import {
  getPopoverPositionClass,
  getShanghaiDecimalHour,
  rangeFocusesForDay,
  rangeSchedulesForDay,
  scheduleAccentColor,
  type CalendarDay,
} from "./calendar-utils";
import type { TrackFilter } from "./CalendarToolbar";

type WeekTimelineProps = {
  weekDays: CalendarDay[];
  scheduleBlocks: ScheduleBlock[];
  focusSessions: FocusSession[];
  entries: Entry[];
  trackFilter: TrackFilter;
  onScheduleClick: (schedule: ScheduleBlock) => void;
  onFocusClick: (entryId: string | null) => void;
  onCreateSchedule: (date: string) => void;
};

const HOUR_ROW_HEIGHT = 56;
const GRID_HEIGHT = 24 * HOUR_ROW_HEIGHT;
const hours = Array.from({ length: 24 }, (_, index) => index);

const formatTime = (value: number) => new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
}).format(value);

const computeTimePosition = (startedAt: string, endedAt: string) => {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const startHour = getShanghaiDecimalHour(start);
  const rawEndHour = getShanghaiDecimalHour(end);
  const endHour = end.getTime() > start.getTime() && rawEndHour <= startHour ? rawEndHour + 24 : rawEndHour;
  const clampedStart = Math.max(0, Math.min(24, startHour));
  const clampedEnd = Math.max(clampedStart + 0.5, Math.min(24, endHour));
  return {
    top: clampedStart * HOUR_ROW_HEIGHT,
    height: Math.max(28, (clampedEnd - clampedStart) * HOUR_ROW_HEIGHT),
  };
};

const getEntryTitle = (entries: Entry[], entryId: string | null | undefined) =>
  entryId ? entries.find((entry) => entry.id === entryId)?.title ?? "未关联专注" : "未关联专注";

export function WeekTimeline({
  weekDays,
  scheduleBlocks,
  focusSessions,
  entries,
  trackFilter,
  onScheduleClick,
  onFocusClick,
  onCreateSchedule,
}: WeekTimelineProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-[920px] flex">
        <div className="w-16 shrink-0 select-none border-r border-zinc-200 pr-2 pt-9 text-right dark:border-zinc-800">
          {hours.map((hour) => (
            <div key={hour} className="flex items-start justify-end font-mono text-[11px] tabular-nums text-zinc-400" style={{ height: `${HOUR_ROW_HEIGHT}px` }}>
              <span>{String(hour).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 divide-x divide-zinc-200 dark:divide-zinc-800 relative">
          <div className="absolute inset-0 pt-9 pointer-events-none">
            {hours.map((hour) => <div key={hour} className="border-b border-zinc-100 dark:border-zinc-800/60" style={{ height: `${HOUR_ROW_HEIGHT}px` }} />)}
          </div>

          {weekDays.map((day, dayIndex) => {
            const daySchedules = rangeSchedulesForDay(day.date, scheduleBlocks);
            const dayFocuses = rangeFocusesForDay(day.date, focusSessions);
            return (
              <div key={day.date} data-testid={`calendar-day-${day.date}`} className="flex flex-col relative min-w-0">
                <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 pb-2 text-center backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
                  <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">{day.dayName}</div>
                  <div className="font-mono text-[10px] text-zinc-400">{day.date.slice(5)}</div>
                </div>
                <div className="relative flex-1" style={{ height: `${GRID_HEIGHT}px` }}>
                  <div className="absolute inset-0 flex">
                    {(trackFilter === "both" || trackFilter === "schedule") && (
                      <div
                        onDoubleClick={(event) => { if (event.target === event.currentTarget) onCreateSchedule(day.date); }}
                        className={`relative border-r border-dashed border-zinc-200/50 dark:border-zinc-800/40 ${trackFilter === "both" ? "w-1/2" : "w-full"}`}
                      >
                        {daySchedules.map(({ item: schedule, range }) => {
                          const position = computeTimePosition(new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString());
                          return (
                            <button
                              key={schedule.id}
                              type="button"
                              onClick={() => onScheduleClick(schedule)}
                              aria-label={`打开日程：${schedule.title}，${formatTime(range.startMs)} 至 ${formatTime(range.endMs)}${schedule.location ? `，地点 ${schedule.location}` : ""}${schedule.recurrenceLabel ? `，${schedule.recurrenceLabel}` : ""}`}
                              style={{ top: `${position.top}px`, height: `${position.height}px` }}
                              className="absolute inset-x-0.5 z-10 group/block cursor-pointer rounded-md text-left transition-transform hover:z-50 hover:scale-[1.01] focus-visible:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.99]"
                            >
                              <div
                                style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(schedule.colorKey) }}
                                className="flex h-full w-full flex-col overflow-hidden rounded-md border border-blue-200 bg-blue-50 p-1.5 text-[11px] text-blue-900 shadow-2xs transition-all hover:border-blue-400 hover:shadow-md dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-200"
                              >
                                <div className="flex items-start justify-between gap-1 leading-tight">
                                  <span className="truncate font-semibold">{schedule.title}</span>
                                  <ArrowRight className="h-3 w-3 shrink-0 text-blue-500 opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-visible/block:opacity-100" aria-hidden="true" />
                                </div>
                                <div className="mt-0.5 font-mono text-[9px] tabular-nums opacity-80">
                                  {formatTime(range.startMs)}–{formatTime(range.endMs)}
                                </div>
                              </div>
                              <div className={`absolute hidden w-64 space-y-2 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150 group-hover/block:block group-focus-visible/block:block dark:bg-zinc-800 ${getPopoverPositionClass(position.top, dayIndex)}`}>
                                <div className="flex items-center justify-between gap-2 border-b border-zinc-700/60 pb-2 font-semibold text-zinc-200">
                                  <span className="truncate">{schedule.title}</span>
                                  <span className="rounded bg-blue-900 px-1.5 py-0.5 font-mono text-[9px] text-blue-200">日程</span>
                                </div>
                                <div className="space-y-1.5 font-mono text-xs tabular-nums text-zinc-300">
                                  <div>时间：{formatTime(range.startMs)} - {formatTime(range.endMs)}</div>
                                  {schedule.location && <div>地点：{schedule.location}</div>}
                                  {schedule.recurrenceLabel && <div className="text-[10px] text-zinc-400">重复：{schedule.recurrenceLabel}</div>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {(trackFilter === "both" || trackFilter === "focus") && (
                      <div className={`relative ${trackFilter === "both" ? "w-1/2" : "w-full"}`}>
                        {dayFocuses.map(({ item: focus, range }) => {
                          const position = computeTimePosition(new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString());
                          const entryId = focus.segments[0]?.entryId ?? null;
                          const entryTitle = getEntryTitle(entries, entryId);
                          return (
                            <button
                              key={focus.id}
                              type="button"
                              onClick={() => onFocusClick(entryId)}
                              aria-label={`打开专注：${entryTitle}，${formatTime(range.startMs)} 至 ${focus.endedAt ? formatTime(range.endMs) : "进行中"}，${focus.captureMode === "timer" ? "实时计时" : "手动补录"}${focus.segments.length > 1 ? `，${focus.segments.length} 个拆分片段` : ""}${focus.outcome ? `，成果 ${focus.outcome}` : ""}${focus.note ? `，备注 ${focus.note}` : ""}`}
                              style={{ top: `${position.top}px`, height: `${position.height}px` }}
                              className="absolute inset-x-0.5 z-10 group/block cursor-pointer rounded-md text-left transition-transform hover:z-50 hover:scale-[1.01] focus-visible:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 active:scale-[0.99]"
                            >
                              <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-purple-200 bg-purple-50 p-1.5 text-[11px] text-purple-900 shadow-2xs transition-all hover:border-purple-400 hover:shadow-md dark:border-purple-800 dark:bg-purple-950/70 dark:text-purple-200">
                                <div className="flex items-start justify-between gap-1 leading-tight">
                                  <span className="truncate font-semibold">{entryTitle}</span>
                                  <ArrowRight className="h-3 w-3 shrink-0 text-purple-500 opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-visible/block:opacity-100" aria-hidden="true" />
                                </div>
                                <div className="mt-0.5 font-mono text-[9px] tabular-nums opacity-80">
                                  {formatTime(range.startMs)}–{focus.endedAt ? formatTime(range.endMs) : "进行中"}
                                </div>
                                {focus.segments.length > 1 && <div className="mt-0.5 truncate text-[9px] font-semibold text-purple-600 dark:text-purple-300">[{focus.segments.length}片段]</div>}
                              </div>
                              <div className={`absolute hidden w-64 space-y-2 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150 group-hover/block:block group-focus-visible/block:block dark:bg-zinc-800 ${getPopoverPositionClass(position.top, dayIndex)}`}>
                                <div className="flex items-center justify-between gap-2 border-b border-zinc-700/60 pb-2 font-semibold text-zinc-200">
                                  <span className="truncate">{entryTitle}</span>
                                  <span className="rounded bg-purple-900 px-1.5 py-0.5 font-mono text-[9px] text-purple-200">专注</span>
                                </div>
                                <div className="space-y-1.5 font-mono text-xs tabular-nums text-zinc-300">
                                  <div>时间：{formatTime(range.startMs)} - {focus.endedAt ? formatTime(range.endMs) : "进行中"}</div>
                                  <div>类型：{focus.captureMode === "timer" ? "实时计时" : "手动补录"}</div>
                                  {focus.outcome && <div className="text-[10px] text-emerald-400">成果：{focus.outcome}</div>}
                                  {focus.note && <div className="text-[10px] text-zinc-400">备注：{focus.note}</div>}
                                </div>
                              </div>
                            </button>
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
  );
}
