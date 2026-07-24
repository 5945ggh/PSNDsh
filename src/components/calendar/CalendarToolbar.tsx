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
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-pretty">周历与时间面板</h1>
          <p className="text-xs text-zinc-500 mt-1">
            按双轨道排布课程日程与专注记录，点击任意日程或专注块即可跳转至对应条目详情。
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs bg-zinc-50 dark:bg-zinc-800" aria-label="周导航">
            <button onClick={() => onWeekChange(shiftDateKey(weekStart, -7))} aria-label="上一周" className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            {isCurrentWeek ? (
              <span aria-current="date" className="px-2 py-1.5 font-medium text-zinc-500 dark:text-zinc-400 select-none">本周</span>
            ) : (
              <button onClick={() => onWeekChange(currentShanghaiWeekStart())} className="px-2 py-1.5 font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">返回本周</button>
            )}
            <button onClick={() => onWeekChange(shiftDateKey(weekStart, 7))} aria-label="下一周" className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 text-xs bg-zinc-50 dark:bg-zinc-800">
            {([
              ["grid", LayoutGrid, "时间轴网格"],
              ["compact", ListFilter, "紧凑看板"],
              ["day", Clock, "单日纵览"],
            ] as const).map(([mode, Icon, label]) => (
              <button key={mode} onClick={() => onViewModeChange(mode)} className={`flex items-center gap-1 px-3 py-1.5 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${displayedViewMode === mode ? activeClass : inactiveClass}`}>
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-xs bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <Eye className="w-3.5 h-3.5 text-zinc-400 ml-1" aria-hidden="true" />
            <select value={trackFilter} onChange={(event) => onTrackFilterChange(event.target.value as TrackFilter)} aria-label="筛选显示轨道" className="bg-transparent font-medium outline-none text-zinc-700 dark:text-zinc-300 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
              <option value="both">双轨呈现 (日程 + 专注)</option>
              <option value="schedule">仅看日程轨道</option>
              <option value="focus">仅看专注轨道</option>
            </select>
          </div>

          <button onClick={onOpenIcs} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><Upload className="w-3.5 h-3.5" aria-hidden="true" /><span>导入日程表</span></button>
          <button onClick={onOpenImports} aria-label="管理导入批次" className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"><FileStack className="h-3.5 w-3.5" aria-hidden="true" /><span>管理导入批次</span></button>
          <button onClick={onOpenTemplates} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /><span>作息模板</span></button>
          <button onClick={onCreateSchedule} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Plus className="w-3.5 h-3.5" aria-hidden="true" /><span>新增日程</span></button>
          <button onClick={onCreateFocus} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-sm hover:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"><Plus className="w-3.5 h-3.5" aria-hidden="true" /><span>补录专注</span></button>
        </div>
      </div>

      <div aria-live="polite" className="text-xs text-zinc-500">
        {isCalendarLoading ? "正在加载本周日程与专注记录..." : calendarError ? `日历数据加载失败：${calendarError}` : `${weekStart} 至 ${weekDays[6]?.date}，日程与专注分别独立呈现`}
      </div>

      <div className="flex items-center justify-between bg-zinc-100/70 dark:bg-zinc-800/40 p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 dark:bg-blue-950 dark:border-blue-800 inline-block" aria-hidden="true" /><span>课程日程轨道 (点击跳转)</span></span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-300 dark:bg-purple-950 dark:border-purple-800 inline-block" aria-hidden="true" /><span>专注事实轨道 (点击跳转)</span></span>
        </div>
        <span className="text-[11px] text-zinc-400 hidden md:block">提示：点击任意日程块或专注块，即可直接跳转至对应条目的详情页面</span>
      </div>
    </>
  );
}
