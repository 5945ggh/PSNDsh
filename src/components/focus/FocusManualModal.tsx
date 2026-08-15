"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { EntryPicker } from "@/components/entries/EntryPicker";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { useData } from "@/context/MockContext";
import { X, PlusCircle, AlertCircle } from "lucide-react";

export const FocusManualModal: React.FC = () => {
  const { isManualModalOpen, setIsManualModalOpen } = useFocusTimer();
  const { api, data, mutate, pendingMutations } = useData();
  const entries = data.entries;

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:30");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const startedAt = `${startDate}T${startTime}:00+08:00`;
    const endedAt = `${endDate}T${endTime}:00+08:00`;

    try {
      await mutate(() => api.addManualFocusSession({
        startedAt,
        endedAt,
        note: note || null,
        outcome: outcome || null,
        entryId: selectedEntryId || null,
      }), {
        backgroundRefresh: true,
        update: (snapshot, session) => ({
          ...snapshot,
          focusSessions: [session, ...snapshot.focusSessions.filter((item) => item.id !== session.id)],
        }),
      });
      setIsManualModalOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  return (
    <Dialog.Root open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-500" aria-hidden="true" />
              <Dialog.Title asChild>
                <h2 className="font-semibold text-base">补录专注记录</h2>
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="关闭对话框"
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="manual-start-date" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              开始日期
            </label>
            <input
              id="manual-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="manual-end-date" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              结束日期
            </label>
            <input
              id="manual-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
            <EntryPicker
              id="manual-entry"
              value={selectedEntryId}
              entries={entries}
              onChange={setSelectedEntryId}
              ariaLabel="关联条目"
            />
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
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                取消
              </button>
            </Dialog.Close>
            <button
              type="submit"
              disabled={pendingMutations > 0}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {pendingMutations > 0 ? "正在保存..." : "保存补录"}
            </button>
          </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
