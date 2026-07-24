import { BookOpen, Pencil, Trash2, X } from "lucide-react";
import type { ScheduleBlock } from "@/lib/domain/types";
import { formatDateKeyInTimezone, formatTimeInTimezone } from "@/lib/time/timezone";
import { SHANGHAI_TIME_ZONE } from "./calendar-utils";

type CalendarEventDetailsProps = {
  schedule: ScheduleBlock | null;
  onClose: () => void;
  onEdit: (schedule: ScheduleBlock) => void;
  onDelete: (schedule: ScheduleBlock) => void;
};

export function CalendarEventDetails({ schedule, onClose, onEdit, onDelete }: CalendarEventDetailsProps) {
  if (!schedule) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="sch-modal-title" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between"><div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-500" aria-hidden="true" /><h2 id="sch-modal-title" className="font-semibold text-base">日程区块详情</h2></div><button onClick={onClose} aria-label="关闭对话框" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X className="w-5 h-5" aria-hidden="true" /></button></div>
        <div className="p-5 space-y-3 text-xs">
          <div><span className="text-zinc-400">标题</span><div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">{schedule.title}</div></div>
          <div className="grid grid-cols-2 gap-2 font-mono tabular-nums"><div><span className="text-zinc-400">开始时间</span><div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{formatDateKeyInTimezone(schedule.startedAt, SHANGHAI_TIME_ZONE)} {formatTimeInTimezone(schedule.startedAt, SHANGHAI_TIME_ZONE)}</div></div><div><span className="text-zinc-400">结束时间</span><div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{formatTimeInTimezone(schedule.endedAt, SHANGHAI_TIME_ZONE)}</div></div></div>
          {schedule.location && <div><span className="text-zinc-400">地点</span><div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{schedule.location}</div></div>}
          {schedule.description && <div><span className="text-zinc-400">备注</span><div className="mt-0.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{schedule.description}</div></div>}
          {schedule.recurrenceLabel && <div><span className="text-zinc-400">重复规则</span><div className="font-medium text-purple-600 dark:text-purple-400 mt-0.5">{schedule.recurrenceLabel}</div></div>}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center"><button onClick={() => onDelete(schedule)} className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline text-xs"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /><span>删除日程</span></button><div className="flex items-center gap-2"><button onClick={() => onEdit(schedule)} className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950/40"><Pencil className="w-3.5 h-3.5" aria-hidden="true" /><span>编辑日程</span></button><button onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium">知道了</button></div></div>
        </div>
      </div>
    </div>
  );
}
