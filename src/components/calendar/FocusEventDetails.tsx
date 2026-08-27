import { useState } from "react";
import { Clock, Save, X } from "lucide-react";
import { EntryPicker } from "@/components/entries/EntryPicker";
import type { Entry, FocusSegment, FocusSession } from "@/lib/domain/types";
import { formatDateKeyInTimezone, formatTimeInTimezone } from "@/lib/time/timezone";
import { SHANGHAI_TIME_ZONE } from "./calendar-utils";

type FocusEventDetailsProps = {
  focus: FocusSession | null;
  entries: Entry[];
  onClose: () => void;
  onSave: (segments: FocusSegment[]) => Promise<void>;
};

export function FocusEventDetails({ focus, entries, onClose, onSave }: FocusEventDetailsProps) {
  const [segments, setSegments] = useState<FocusSegment[]>(() => focus?.segments.map((segment) => ({ ...segment })) ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditable = Boolean(focus?.endedAt);

  if (!focus) return null;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(segments);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存专注归属失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="focus-modal-title" className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <h2 id="focus-modal-title" className="text-base font-semibold">专注记录详情</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭对话框" className="rounded p-1 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:hover:text-zinc-200">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-xs">
          <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
            <div><span className="text-zinc-400">开始时间</span><div className="mt-0.5 font-medium">{formatDateKeyInTimezone(focus.startedAt, SHANGHAI_TIME_ZONE)} {formatTimeInTimezone(focus.startedAt, SHANGHAI_TIME_ZONE)}</div></div>
            <div><span className="text-zinc-400">结束时间</span><div className="mt-0.5 font-medium">{focus.endedAt ? formatTimeInTimezone(focus.endedAt, SHANGHAI_TIME_ZONE) : "进行中"}</div></div>
          </div>
          {focus.outcome && <div><span className="text-zinc-400">成果</span><p className="mt-0.5 text-zinc-700 dark:text-zinc-300">{focus.outcome}</p></div>}
          {focus.note && <div><span className="text-zinc-400">备注</span><p className="mt-0.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{focus.note}</p></div>}

          <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div>
              <h3 className="font-medium text-zinc-800 dark:text-zinc-200">绑定方向或待办</h3>
              <p className="mt-1 text-[11px] text-zinc-500">可以为每个片段选择条目，未关联的片段也可以保留。</p>
            </div>
            {!isEditable && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">进行中的专注请结束后再编辑归属。</p>}
            {segments.map((segment, index) => (
              <div key={segment.id} className="space-y-1.5 rounded-lg border border-purple-100 bg-purple-50/40 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>片段 {index + 1}</span>
                  <span className="font-mono">{formatTimeInTimezone(segment.startedAt, SHANGHAI_TIME_ZONE)} - {formatTimeInTimezone(segment.endedAt, SHANGHAI_TIME_ZONE)}</span>
                </div>
                {isEditable ? (
                  <EntryPicker
                    id={`focus-detail-entry-${segment.id}`}
                    value={segment.entryId}
                    entries={entries}
                    onChange={(entryId) => setSegments((current) => current.map((item) => item.id === segment.id ? { ...item, entryId } : item))}
                    ariaLabel={`片段 ${index + 1} 关联条目`}
                  />
                ) : (
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">{segment.entryId ? entries.find((entry) => entry.id === segment.entryId)?.title ?? "未关联（条目已归档）" : "未关联（无归属）"}</div>
                )}
              </div>
            ))}
            {segments.length === 0 && <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center text-zinc-400 dark:border-zinc-800">没有可编辑的专注片段</p>}
          </div>

          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">取消</button>
          <button type="button" onClick={() => void handleSave()} disabled={isSaving || !isEditable || segments.length === 0} className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {isSaving ? "保存中…" : isEditable ? "保存归属" : "结束后可编辑"}
          </button>
        </div>
      </div>
    </div>
  );
}
