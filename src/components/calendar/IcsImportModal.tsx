"use client";

import React, { useState } from "react";
import { useData } from "@/context/MockContext";
import {
  DEFAULT_TIMEZONE,
  formatDateKeyInTimezone,
  formatTimeInTimezone,
} from "@/lib/time/timezone";
import type { IcsImportPreview } from "@/lib/domain/types";
import { X, FileCode, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";

interface IcsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const isIcsFile = (file: File) =>
  file.name.toLowerCase().endsWith(".ics") || file.type === "text/calendar";

export const IcsImportModal: React.FC<IcsImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { api, data, mutate } = useData();
  const timezone = data.capabilities?.effectiveTimezone ?? DEFAULT_TIMEZONE;
  const [previewData, setPreviewData] = useState<IcsImportPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"file" | "preview">("file");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const closeAndReset = () => {
    onClose();
    setStep("file");
    setSelectedFile(null);
    setFileError(null);
    setPreviewData(null);
    setSelectedUids(new Set());
    setIsPreviewLoading(false);
  };

  if (!isOpen) return null;

  const toggleRow = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!previewData) return;
    const count = await mutate(
      () => api.confirmIcsImport(previewData.importId, Array.from(selectedUids)),
      { backgroundRefresh: true }
    );
    alert(`成功导入 ${count} 门课程/日程至日历表！`);
    closeAndReset();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFileError(null);
    if (!file) return;

    if (!isIcsFile(file)) {
      setFileError("请选择 .ics 后缀的日程表文件。");
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setFileError("请先选择一个 .ics 日程表文件。");
      return;
    }
    if (fileError || !isIcsFile(selectedFile)) {
      setFileError("请选择 .ics 后缀的日程表文件。");
      return;
    }
    setIsPreviewLoading(true);
    setFileError(null);
    try {
      const preview = await api.previewIcsImport(selectedFile.name, await selectedFile.text());
      setPreviewData(preview);
      setSelectedUids(
        new Set(preview.rows.filter((row) => row.selected).map((row) => row.sourceUid))
      );
      setStep("preview");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "解析日程表失败");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const canPreview = Boolean(selectedFile && !fileError && !isPreviewLoading);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ics-modal-title"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-purple-500" aria-hidden="true" />
            <h2 id="ics-modal-title" className="font-semibold text-base">导入日程表</h2>
          </div>
          <button
            onClick={closeAndReset}
            aria-label="关闭对话框"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {step === "file" ? (
            <div className="space-y-4 py-6">
              <label className="block border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 hover:border-purple-500 transition-colors text-center cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-500">
                <FileCode className="w-10 h-10 text-zinc-400 mx-auto mb-2" aria-hidden="true" />
                <p className="font-medium text-sm">选择 .ics 格式的日程表文件</p>
                <p className="text-zinc-400 text-xs mt-1">
                  解析后将先进行两阶段预览与确认
                </p>
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  aria-label="选择 .ics 日程表文件"
                  onChange={handleFileChange}
                  className="sr-only"
                  aria-describedby="ics-file-help"
                />
                <span
                  id="ics-file-help"
                  className="mt-3 inline-flex rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  选择 .ics 文件
                </span>
              </label>

              <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left dark:border-zinc-800 dark:bg-zinc-900/50" aria-labelledby="ics-support-title">
                <h3 id="ics-support-title" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">目前支持的 ICS</h3>
                <p className="mt-1 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                  支持带时间的 VEVENT、UTC、IANA TZID 和无时区浮动时间；支持有限窗口内的 RRULE、EXDATE 与 RECURRENCE-ID 调课。
                  无时区时间统一按 {timezone} 解释。
                </p>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-500">
                  单文件不超过 1 MiB、最多 200 个事件和 1,000 个展开实例；全天事件、无结束时间和无效时间范围会列入过滤说明。重复事件只展开未来 180 天。
                </p>
              </section>

              {selectedFile && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left dark:border-zinc-800 dark:bg-zinc-800/30">
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    已选择：{selectedFile.name}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    大小：{Math.max(1, Math.round(selectedFile.size / 1024))} KB
                  </div>
                </div>
              )}

              {fileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-left text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {fileError}
                </div>
              )}

              <button
                onClick={() => { void handlePreview(); }}
                disabled={!canPreview}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {isPreviewLoading
                    ? "正在解析..."
                    : "解析日程表预览"}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : previewData ? (
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 p-3 rounded-lg flex items-center justify-between text-purple-900 dark:text-purple-200">
                <div>
                  <div className="font-medium">来源：{previewData.sourceName || previewData.fileName}</div>
                  <div className="text-[10px] opacity-80">文件：{previewData.fileName}{previewData.isUpdate ? " · 这是已有来源的更新" : " · 新来源"}</div>
                  <div className="text-[10px] opacity-80">
                    解析出 {previewData.rows.length} 条可确认日程，{previewData.errors.length} 条已过滤
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-200 dark:bg-purple-900">
                  {previewData.importId}
                </span>
              </div>

              {previewData.diff && (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] dark:border-zinc-800 dark:bg-zinc-900/50 sm:grid-cols-5">
                  <span className="text-emerald-700 dark:text-emerald-300">新增 {previewData.diff.added}</span>
                  <span className="text-blue-700 dark:text-blue-300">修改 {previewData.diff.updated}</span>
                  <span className="text-red-700 dark:text-red-300">删除 {previewData.diff.removed}</span>
                  <span className="text-amber-700 dark:text-amber-300">取消 {previewData.diff.cancelled}</span>
                  <span className="text-zinc-500">未变 {previewData.diff.unchanged}</span>
                </div>
              )}

              {/* Rows List */}
              <div className="space-y-2">
                {previewData.rows.map((row) => {
                  const isChecked = selectedUids.has(row.sourceUid);
                  return (
                    <div
                      key={row.sourceUid}
                      onClick={() => toggleRow(row.sourceUid)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-white dark:bg-zinc-800 border-purple-500 shadow-2xs"
                          : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            aria-label={`选择 ${row.title}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleRow(row.sourceUid)}
                            className="mt-0.5 rounded text-purple-600 focus-visible:ring-2 focus-visible:ring-purple-500"
                          />
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {row.title}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono mt-0.5 tabular-nums">
                              {formatDateKeyInTimezone(row.startedAt, timezone)} {formatTimeInTimezone(row.startedAt, timezone)}–{formatTimeInTimezone(row.endedAt, timezone)} {row.recurrenceLabel ? `(${row.recurrenceLabel})` : ""}
                            </div>
                            {(row.location || row.description) && (
                              <div className="mt-1 max-w-[26rem] truncate text-[10px] text-zinc-500">
                                {row.location ? `地点：${row.location}` : ""}{row.location && row.description ? " · " : ""}{row.description ? `备注：${row.description}` : ""}
                              </div>
                            )}
                            {(row.duplicateCount ?? 0) > 0 && (
                              <div className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                已存在 {row.duplicateCount} 个同源实例，默认跳过
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Warnings */}
                      {row.warnings.length > 0 && (
                        <div className="mt-2 pl-6 space-y-1">
                          {row.warnings.map((w, idx) => (
                            <div
                              key={idx}
                              className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Errors section */}
              {previewData.errors.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg space-y-1">
                  <div className="font-semibold text-red-700 dark:text-red-300">
                    自动过滤说明：
                  </div>
                  {previewData.errors.map((err, idx) => (
                    <p key={idx} className="text-[10px] text-red-600 dark:text-red-400">
                      • {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              暂无可预览的日程表解析结果。
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={closeAndReset}
            className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            取消
          </button>

          {step === "preview" && (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{previewData?.diff?.removed || previewData?.diff?.updated || previewData?.diff?.cancelled ? `确认应用 ${selectedUids.size} 个事件` : `确认写入选中的 ${selectedUids.size} 项日程`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
