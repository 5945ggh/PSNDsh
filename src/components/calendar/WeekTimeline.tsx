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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm overflow-x-auto">
      <div className="min-w-[900px] flex">
        <div className="w-16 shrink-0 border-r border-zinc-200 dark:border-zinc-800 pr-2 pt-9 space-y-0 text-right select-none">
          {hours.map((hour) => <div key={hour} className="font-mono text-[11px] text-zinc-400 tabular-nums flex items-start justify-end" style={{ height: `${HOUR_ROW_HEIGHT}px` }}><span>{String(hour).padStart(2, "0")}:00</span></div>)}
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
                <div className="text-center pb-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 sticky top-0">
                  <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">{day.dayName}</div>
                  <div className="text-[10px] font-mono text-zinc-400">{day.date.slice(5)}</div>
                </div>
                <div className="relative flex-1" style={{ height: `${GRID_HEIGHT}px` }}>
                  <div className="absolute inset-0 flex">
                    {(trackFilter === "both" || trackFilter === "schedule") && (
                      <div onDoubleClick={(event) => { if (event.target === event.currentTarget) onCreateSchedule(day.date); }} className={`relative border-r border-dashed border-zinc-200/50 dark:border-zinc-800/40 ${trackFilter === "both" ? "w-1/2" : "w-full"}`}>
                        {daySchedules.map(({ item: schedule, range }) => {
                          const position = computeTimePosition(new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString());
                          return (
                            <div key={schedule.id} onClick={() => onScheduleClick(schedule)} style={{ top: `${position.top}px`, height: `${position.height}px` }} className="absolute inset-x-0.5 group/block z-10 hover:z-50 cursor-pointer">
                              <div style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(schedule.colorKey) }} className="w-full h-full p-1.5 rounded bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-[11px] overflow-hidden shadow-2xs hover:border-blue-400 hover:shadow-md transition-all">
                                <div className="font-semibold truncate leading-tight flex items-center justify-between"><span className="truncate">{schedule.title}</span><ArrowRight className="w-3 h-3 opacity-0 group-hover/block:opacity-100 shrink-0 text-blue-500" /></div>
                                <div className="text-[9px] font-mono opacity-80 tabular-nums">{formatTime(range.startMs)}–{formatTime(range.endMs)}</div>
                              </div>
                              <div className={`absolute hidden group-hover/block:block group-focus-within/block:block z-50 w-64 p-4 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl text-sm space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${getPopoverPositionClass(position.top, dayIndex)}`}>
                                <div className="font-semibold text-zinc-200 border-b border-zinc-700/60 pb-2 flex items-center justify-between gap-2"><span className="truncate">{schedule.title}</span><span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-900 text-blue-200">日程 (点击跳转)</span></div>
                                <div className="space-y-1.5 text-xs font-mono text-zinc-300 tabular-nums"><div>时间：{formatTime(range.startMs)} – {formatTime(range.endMs)}</div>{schedule.location && <div>地点：{schedule.location}</div>}{schedule.recurrenceLabel && <div className="text-[10px] text-zinc-400">重复：{schedule.recurrenceLabel}</div>}</div>
                              </div>
                            </div>
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
                            <div key={focus.id} onClick={() => onFocusClick(entryId)} style={{ top: `${position.top}px`, height: `${position.height}px` }} className="absolute inset-x-0.5 group/block z-10 hover:z-50 cursor-pointer">
                              <div className="w-full h-full p-1.5 rounded bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-[11px] overflow-hidden shadow-2xs hover:border-purple-400 hover:shadow-md transition-all">
                                <div className="font-semibold truncate leading-tight flex items-center justify-between"><span className="truncate">{entryTitle}</span><ArrowRight className="w-3 h-3 opacity-0 group-hover/block:opacity-100 shrink-0 text-purple-500" /></div>
                                <div className="text-[9px] font-mono opacity-80 tabular-nums">{formatTime(range.startMs)}–{focus.endedAt ? formatTime(range.endMs) : "进行中"}</div>
                                {focus.segments.length > 1 && <div className="text-[9px] text-purple-600 dark:text-purple-300 font-semibold truncate">[{focus.segments.length}片段]</div>}
                              </div>
                              <div className={`absolute hidden group-hover/block:block group-focus-within/block:block z-50 w-64 p-4 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl text-sm space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${getPopoverPositionClass(position.top, dayIndex)}`}>
                                <div className="font-semibold text-zinc-200 border-b border-zinc-700/60 pb-2 flex items-center justify-between gap-2"><span className="truncate">{entryTitle}</span><span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-900 text-purple-200">专注 (点击跳转)</span></div>
                                <div className="space-y-1.5 text-xs font-mono text-zinc-300 tabular-nums"><div>时间：{formatTime(range.startMs)} – {focus.endedAt ? formatTime(range.endMs) : "进行中"}</div><div>类型：{focus.captureMode === "timer" ? "实时计时" : "手动补录"}</div>{focus.outcome && <div className="text-[10px] text-emerald-400">成果：{focus.outcome}</div>}{focus.note && <div className="text-[10px] text-zinc-400">备注：{focus.note}</div>}</div>
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
  );
}
