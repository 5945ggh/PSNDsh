import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileStack,
  LayoutGrid,
  ListFilter,
  Plus,
  Upload,
} from "lucide-react";
import { currentShanghaiWeekStart, shiftDateKey, type CalendarDay } from "./calendar-utils";

export type CalendarViewMode = "grid" | "compact" | "day";
export type TrackFilter = "both" | "schedule" | "focus";

type CalendarToolbarProps = {
  weekStart: string;
  weekDays: CalendarDay[];
  isCalendarLoading: boolean;
  calendarError: string | null;
  displayedViewMode: CalendarViewMode;
  trackFilter: TrackFilter;
  onWeekChange: (weekStart: string) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onTrackFilterChange: (filter: TrackFilter) => void;
  onOpenIcs: () => void;
  onOpenImports: () => void;
  onOpenTemplates: () => void;
  onCreateSchedule: () => void;
  onCreateFocus: () => void;
};

const activeClass = "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs";
const inactiveClass = "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200";

export function CalendarToolbar({
  weekStart,
  weekDays,
  isCalendarLoading,
  calendarError,
  displayedViewMode,
  trackFilter,
  onWeekChange,
  onViewModeChange,
  onTrackFilterChange,
  onOpenIcs,
  onOpenImports,
  onOpenTemplates,
  onCreateSchedule,
  onCreateFocus,
}: CalendarToolbarProps) {
  const isCurrentWeek = weekStart === currentShanghaiWeekStart();
  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">周历与时间面板</h1>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                双轨呈现
              </span>
            </div>
            <p className="max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              计划与事实分轨查看，日程和专注各自可跳转。
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-xs dark:border-zinc-700 dark:bg-zinc-800" aria-label="周导航">
                <button
                  onClick={() => onWeekChange(shiftDateKey(weekStart, -7))}
                  aria-label="上一周"
                  className="rounded p-1.5 text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {isCurrentWeek ? (
                  <span aria-current="date" className="select-none px-2 py-1.5 font-medium text-zinc-500 dark:text-zinc-400">
                    本周
                  </span>
                ) : (
                  <button
                    onClick={() => onWeekChange(currentShanghaiWeekStart())}
                    className="rounded px-2 py-1.5 font-medium text-zinc-700 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-300 dark:hover:text-white"
                  >
                    返回本周
                  </button>
                )}
                <button
                  onClick={() => onWeekChange(shiftDateKey(weekStart, 7))}
                  aria-label="下一周"
                  className="rounded p-1.5 text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                {([
                  ["grid", LayoutGrid, "时间轴网格"],
                  ["compact", ListFilter, "紧凑看板"],
                  ["day", Clock, "单日纵览"],
                ] as const).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    onClick={() => onViewModeChange(mode)}
                    className={`flex items-center gap-1 rounded px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${displayedViewMode === mode ? activeClass : inactiveClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100/80 p-1 text-xs dark:border-zinc-700 dark:bg-zinc-800/80">
                <Eye className="ml-1 h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                <select
                  value={trackFilter}
                  onChange={(event) => onTrackFilterChange(event.target.value as TrackFilter)}
                  aria-label="筛选显示轨道"
                  className="rounded bg-transparent text-xs font-medium text-zinc-700 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-300"
                >
                  <option value="both">双轨呈现 (日程 + 专注)</option>
                  <option value="schedule">仅看日程轨道</option>
                  <option value="focus">仅看专注轨道</option>
                </select>
              </div>

              <button
                onClick={onOpenIcs}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>导入日程表</span>
              </button>
              <button
                onClick={onOpenImports}
                aria-label="管理导入批次"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <FileStack className="h-3.5 w-3.5" aria-hidden="true" />
                <span>管理导入批次</span>
              </button>
              <button
                onClick={onOpenTemplates}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>作息模板</span>
              </button>
              <button
                onClick={onCreateSchedule}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>新增日程</span>
              </button>
              <button
                onClick={onCreateFocus}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>补录专注</span>
              </button>
            </div>
          </div>
        </div>

        <div aria-live="polite" className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          {isCalendarLoading ? "正在加载本周日程与专注记录..." : calendarError ? `日历数据加载失败：${calendarError}` : `${weekStart} 至 ${weekDays[6]?.date}，日程与专注分别独立呈现`}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/60 bg-zinc-100/70 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400">
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 dark:bg-zinc-900">
            <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100 dark:border-blue-800 dark:bg-blue-950" aria-hidden="true" />
            <span>课程日程</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 dark:bg-zinc-900">
            <span className="inline-block h-3 w-3 rounded border border-purple-300 bg-purple-100 dark:border-purple-800 dark:bg-purple-950" aria-hidden="true" />
            <span>专注事实</span>
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">点击块可跳转详情</span>
        </div>
      </div>
    </>
  );
}
