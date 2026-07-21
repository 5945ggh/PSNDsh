"use client";

import React, { useState } from "react";
import { useMock } from "@/context/MockContext";
import { X, FileCode, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";

interface IcsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IcsImportModal: React.FC<IcsImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { api } = useMock();
  const previewData = api.getIcsPreview();

  const [selectedUids, setSelectedUids] = useState<Set<string>>(
    new Set(previewData.rows.filter((r) => r.selected).map((r) => r.sourceUid))
  );
  const [step, setStep] = useState<"file" | "preview">("file");

  if (!isOpen) return null;

  const toggleRow = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleConfirm = () => {
    const count = api.confirmIcsImport(Array.from(selectedUids));
    alert(`成功导入 ${count} 门课程/日程至日历表！`);
    onClose();
  };

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
            <h2 id="ics-modal-title" className="font-semibold text-base">导入 ICS 日历文件</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭对话框"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {step === "file" ? (
            <div className="space-y-4 text-center py-6">
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 hover:border-purple-500 transition-colors">
                <FileCode className="w-10 h-10 text-zinc-400 mx-auto mb-2" aria-hidden="true" />
                <p className="font-medium text-sm">选择 .ics 格式的课表或日历文件</p>
                <p className="text-zinc-400 text-xs mt-1">
                  解析后将先进行两阶段预览与确认
                </p>
              </div>

              <button
                onClick={() => setStep("preview")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <span>解析课表预览</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 p-3 rounded-lg flex items-center justify-between text-purple-900 dark:text-purple-200">
                <div>
                  <div className="font-medium">文件：{previewData.fileName}</div>
                  <div className="text-[10px] opacity-80">
                    解析出 {previewData.rows.length} 条有效日程，1 条规则自动过滤
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-200 dark:bg-purple-900">
                  {previewData.importId}
                </span>
              </div>

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
                            onChange={() => {}}
                            className="mt-0.5 rounded text-purple-600 focus-visible:ring-2 focus-visible:ring-purple-500"
                          />
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {row.title}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono mt-0.5 tabular-nums">
                              {row.startedAt.slice(0, 10)} {row.startedAt.slice(11, 16)}–{row.endedAt.slice(11, 16)} {row.recurrenceLabel ? `(${row.recurrenceLabel})` : ""}
                            </div>
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
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
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
              <span>确认写入选中的 {selectedUids.size} 项日程</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
