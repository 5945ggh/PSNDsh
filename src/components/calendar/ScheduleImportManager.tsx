"use client";

import { useEffect, useState } from "react";
import { FileStack, LoaderCircle, Trash2, X } from "lucide-react";
import { useData } from "@/context/MockContext";
import type { ScheduleImport } from "@/lib/domain/types";

type ScheduleImportManagerProps = {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

const formatImportedAt = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
}).format(new Date(value));

export function ScheduleImportManager({ isOpen, onClose, onChanged }: ScheduleImportManagerProps) {
  const { api } = useData();
  const [imports, setImports] = useState<ScheduleImport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      setIsLoading(true);
      setError(null);
      try {
        const nextImports = await api.getScheduleImports();
        if (!cancelled) setImports(nextImports);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "导入批次加载失败");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [api, isOpen]);

  if (!isOpen) return null;

  const deleteImport = async (item: ScheduleImport) => {
    if (!window.confirm(`确定删除“${item.fileName}”导入的 ${item.blockCount} 项日程吗？此操作不可撤销。`)) return;
    setDeletingId(item.id);
    setError(null);
    try {
      await api.deleteScheduleImport(item.id);
      setImports((current) => current.filter((candidate) => candidate.id !== item.id));
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除导入批次失败");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="schedule-import-manager-title" className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-purple-500" aria-hidden="true" />
            <h2 id="schedule-import-manager-title" className="font-semibold">已导入的日程批次</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭导入批次" className="rounded p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-zinc-200">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-40 space-y-3 overflow-y-auto p-5 text-sm">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />正在加载导入批次...</div>
          ) : imports.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-zinc-500 dark:border-zinc-700">当前账号还没有可管理的 ICS 导入批次。</div>
          ) : (
            imports.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.fileName}</div>
                  <div className="mt-1 text-xs text-zinc-500">{item.blockCount} 项实例 · {formatImportedAt(item.importedAt)}</div>
                </div>
                <button type="button" onClick={() => void deleteImport(item)} disabled={deletingId !== null} aria-label={`删除 ${item.fileName} 导入批次`} className="flex shrink-0 items-center gap-1 rounded px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/30">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{deletingId === item.id ? "删除中..." : "删除整批"}</span>
                </button>
              </div>
            ))
          )}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">关闭</button>
        </div>
      </div>
    </div>
  );
}
