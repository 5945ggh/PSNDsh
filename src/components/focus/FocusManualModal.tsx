"use client";

import React, { useState } from "react";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { useMock } from "@/context/MockContext";
import { X, PlusCircle, AlertCircle } from "lucide-react";

export const FocusManualModal: React.FC = () => {
  const { isManualModalOpen, setIsManualModalOpen } = useFocusTimer();
  const { api } = useMock();
  const entries = api.getEntries();

  const [dateStr, setDateStr] = useState("2026-06-26");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:30");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isManualModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const startedAt = `${dateStr}T${startTime}:00+08:00`;
    const endedAt = `${dateStr}T${endTime}:00+08:00`;

    try {
      api.addManualFocusSession({
        startedAt,
        endedAt,
        note: note || null,
        outcome: outcome || null,
        entryId: selectedEntryId || null,
      });
      setIsManualModalOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-modal-title"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-blue-500" aria-hidden="true" />
            <h2 id="manual-modal-title" className="font-semibold text-base">补录专注记录</h2>
          </div>
          <button
            onClick={() => setIsManualModalOpen(false)}
            aria-label="关闭对话框"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="manual-date" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              日期
            </label>
            <input
              id="manual-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-start" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                开始时间
              </label>
              <input
                id="manual-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="manual-end" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                结束时间
              </label>
              <input
                id="manual-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="manual-entry" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              关联条目
            </label>
            <select
              id="manual-entry"
              value={selectedEntryId || ""}
              onChange={(e) => setSelectedEntryId(e.target.value || null)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">未关联 (无归属)</option>
              {entries.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="manual-outcome" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              专注成果
            </label>
            <input
              id="manual-outcome"
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="填写该时间段完成的工作…"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="manual-note" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              备注说明
            </label>
            <input
              id="manual-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="补录备注说明…"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              保存补录
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
