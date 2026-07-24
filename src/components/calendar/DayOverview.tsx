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
  onFocusClick: (entryId: string | null) => void;
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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <button onClick={() => onSelectedDayChange(weekDays[Math.max(0, selectedDayIndex - 1)]!.date)} aria-label="前一天" className="p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"><ChevronLeft className="w-5 h-5" aria-hidden="true" /></button>
        <div className="text-center"><span className="font-semibold text-sm">{selectedDayMeta.date} ({selectedDayMeta.dayName})</span><p className="text-[10px] text-zinc-400 mt-0.5">{schedules.length} 项日程，{focuses.length} 条专注</p></div>
        <button onClick={() => onSelectedDayChange(weekDays[Math.min(weekDays.length - 1, selectedDayIndex + 1)]!.date)} aria-label="后一天" className="p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"><ChevronRight className="w-5 h-5" aria-hidden="true" /></button>
      </div>

      <div className="space-y-4 text-xs">
        {(trackFilter === "both" || trackFilter === "schedule") && <div className="space-y-2"><h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><BookOpen className="w-4 h-4" aria-hidden="true" /><span>课程日程轨道</span></h3><div className="space-y-2">{schedules.length > 0 ? schedules.map(({ item: schedule, range }) => <div key={schedule.id} onClick={() => onScheduleClick(schedule)} style={{ borderLeftWidth: "3px", borderLeftColor: scheduleAccentColor(schedule.colorKey) }} className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-between gap-3 group"><div className="min-w-0"><div className="font-semibold text-blue-900 dark:text-blue-200 truncate">{schedule.title}</div><div className="text-zinc-500 font-mono text-[11px] mt-0.5 tabular-nums">{formatTime(range.startMs)} – {formatTime(range.endMs)}{schedule.location ? ` • ${schedule.location}` : ""}</div>{schedule.recurrenceLabel && <div className="text-[10px] text-blue-600 dark:text-blue-300 mt-1">{schedule.recurrenceLabel}</div>}</div><ArrowRight className="w-4 h-4 text-blue-500 opacity-60 group-hover:opacity-100 shrink-0" /></div>) : <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40">该日没有匹配的课程日程</div>}</div></div>}

        {(trackFilter === "both" || trackFilter === "focus") && <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800"><h3 className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5"><Clock className="w-4 h-4" aria-hidden="true" /><span>专注轨道片段</span></h3><div className="space-y-2">{focuses.length > 0 ? focuses.map(({ item: focus, range }) => {
          const entryId = focus.segments[0]?.entryId ?? null;
          const title = entryId ? entries.find((entry) => entry.id === entryId)?.title ?? "未关联专注" : "未关联专注";
          const segments = focus.segments.flatMap((segment) => {
            const segmentRange = overlapRange(selectedDay, segment.startedAt, segment.endedAt);
            return segmentRange ? [{ ...segment, title: segment.entryId ? entries.find((entry) => entry.id === segment.entryId)?.title ?? "未关联片段" : "未关联片段", range: segmentRange }] : [];
          });
          return <div key={focus.id} onClick={() => onFocusClick(entryId)} className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer hover:border-purple-400 transition-colors flex flex-col gap-2 group"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="font-semibold text-purple-900 dark:text-purple-200 truncate">{title}</div><div className="text-zinc-500 font-mono text-[11px] mt-0.5 tabular-nums">{formatTime(range.startMs)} – {focus.endedAt ? formatTime(range.endMs) : "进行中"}{focus.captureMode === "manual" ? " • 手动补录" : " • 实时计时"}</div></div><ArrowRight className="w-4 h-4 text-purple-500 opacity-60 group-hover:opacity-100 shrink-0" /></div>{focus.outcome && <div className="text-[11px] text-emerald-700 dark:text-emerald-300">成果：{focus.outcome}</div>}{focus.note && <div className="text-[11px] text-zinc-500">备注：{focus.note}</div>}{segments.length > 0 && <div className="space-y-1 border-t border-purple-200/70 dark:border-purple-900/60 pt-2">{segments.map((segment) => <div key={segment.id} className="flex items-center justify-between gap-2 text-[10px] text-purple-700 dark:text-purple-300 font-mono tabular-nums"><span className="truncate">{segment.title}</span><span className="shrink-0">{formatTime(segment.range.startMs)} – {formatTime(segment.range.endMs)}</span></div>)}</div>}</div>;
        }) : <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40">该日没有匹配的专注记录</div>}</div></div>}
      </div>
    </div>
  );
}
