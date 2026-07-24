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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm overflow-x-auto">
      <div className="min-w-[800px] grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const daySchedules = rangeSchedulesForDay(day.date, scheduleBlocks);
          const dayFocuses = rangeFocusesForDay(day.date, focusSessions);
          return (
            <div key={day.date} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3 min-h-[360px]">
              <div className="text-center border-b border-zinc-200 dark:border-zinc-800 pb-2"><div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">{day.dayName}</div><div className="text-[10px] font-mono text-zinc-400">{day.date.slice(5)}</div></div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-semibold uppercase text-blue-600 dark:text-blue-400 block">日程轨道</span>
                {daySchedules.length > 0 ? daySchedules.map(({ item: schedule, range }) => (
                  <div key={schedule.id} onClick={() => onScheduleClick(schedule)} style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(schedule.colorKey) }} className="p-2 rounded border text-xs space-y-0.5 bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 cursor-pointer hover:border-blue-400 transition-colors group">
                    <div className="font-medium truncate flex items-center justify-between"><span className="truncate">{schedule.title}</span><ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 text-blue-500" /></div><div className="text-[10px] font-mono opacity-80 tabular-nums">{formatTime(range.startMs)}–{formatTime(range.endMs)}</div>
                  </div>
                )) : <div className="text-[10px] text-zinc-400 italic py-1">无预排日程</div>}
              </div>
              <div className="space-y-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                <span className="text-[9px] font-semibold uppercase text-purple-600 dark:text-purple-400 block">专注事实轨道</span>
                {dayFocuses.length > 0 ? dayFocuses.map(({ item: focus, range }) => {
                  const entryId = focus.segments[0]?.entryId ?? null;
                  const title = entryId ? entries.find((entry) => entry.id === entryId)?.title ?? "未关联专注" : "未关联专注";
                  return <div key={focus.id} onClick={() => onFocusClick(entryId)} className="p-2 rounded border text-xs space-y-0.5 bg-purple-50/80 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 cursor-pointer hover:border-purple-400 transition-colors group"><div className="font-medium truncate flex items-center justify-between"><span className="truncate">{title}</span><ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 text-purple-500" /></div><div className="text-[10px] font-mono opacity-80 tabular-nums">{formatTime(range.startMs)}–{focus.endedAt ? formatTime(range.endMs) : "进行中"}</div>{focus.segments.length > 1 && <div className="text-[9px] text-purple-600 dark:text-purple-400 font-semibold">[{focus.segments.length} 个拆分片段]</div>}</div>;
                }) : <div className="text-[10px] text-zinc-400 italic py-1">无专注记录</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
