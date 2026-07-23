"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { useData } from "@/context/MockContext";
import { FocusSegment, FocusSession } from "@/types/mock";
import { X, Split, Save, AlertCircle, Plus, Trash2 } from "lucide-react";

export const FocusSplitModal: React.FC = () => {
  const { activeFocus, setIsSplitModalOpen } = useFocusTimer();

  if (!activeFocus) {
    return <Dialog.Root open={false} onOpenChange={setIsSplitModalOpen} />;
  }

  return <FocusSplitModalDialog key={activeFocus.id} activeFocus={activeFocus} />;
};

const FocusSplitModalDialog: React.FC<{ activeFocus: FocusSession }> = ({ activeFocus }) => {
  const { isSplitModalOpen, setIsSplitModalOpen, finishStopFocus, elapsedSeconds, formattedTime } =
    useFocusTimer();
  const { data } = useData();
  const entries = data.entries;

  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [segments, setSegments] = useState<
    Array<{ id: string; minutes: number; entryId: string | null; note: string }>
  >([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

  const isOpen = isSplitModalOpen;

  const draftSegments = segments.length > 0 ? segments : [{
    id: "seg_draft_default",
    minutes: totalMinutes,
    entryId: entries[0]?.id || null,
    note: "",
  }];

  const handleSave = () => {
    setErrorMsg(null);

    let finalSegments: FocusSegment[] = [];
    const sessionStart = new Date(activeFocus.startedAt);
    const sessionEnd = new Date();

    if (isSplitEnabled) {
      const sumMin = draftSegments.reduce((acc, s) => acc + Number(s.minutes), 0);
      if (sumMin !== totalMinutes) {
        setErrorMsg(
          `SEGMENTS_INVALID_PARTITION: 片段时长之和 (${sumMin} 分钟) 必须等于总专注时长 (${totalMinutes} 分钟)！`
        );
        return;
      }

      let currentPointerMs = sessionStart.getTime();
      finalSegments = draftSegments.map((s, idx) => {
        const segStartMs = currentPointerMs;
        const segEndMs =
          idx === draftSegments.length - 1
            ? sessionEnd.getTime()
            : segStartMs + s.minutes * 60 * 1000;
        currentPointerMs = segEndMs;

        return {
          id: `seg_${Date.now()}_${idx}`,
          startedAt: new Date(segStartMs).toISOString(),
          endedAt: new Date(segEndMs).toISOString(),
          entryId: s.entryId || null,
          note: s.note || null,
        };
      });
    } else {
      const defaultEntryId = activeFocus.segments[0]?.entryId || null;
      finalSegments = [
        {
          id: `seg_${Date.now()}_default`,
          startedAt: activeFocus.startedAt,
          endedAt: sessionEnd.toISOString(),
          entryId: defaultEntryId,
          note: note || null,
        },
      ];
    }

    finishStopFocus(outcome || null, note || null, finalSegments);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsSplitModalOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <Dialog.Title asChild>
                <h2 className="font-semibold text-base">结束本次专注</h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  总时长：<strong className="text-blue-600 dark:text-blue-400 font-semibold tabular-nums">{formattedTime}</strong> ({totalMinutes} 分钟)
                </p>
              </Dialog.Description>
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

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="outcome-input" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              专注成果
            </label>
            <input
              id="outcome-input"
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="例如：完成 LockLab 锁实现，通过并发测试…"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="note-input" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              备注与心得
            </label>
            <textarea
              id="note-input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="记录疑难点或后续待办…"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          {/* Progressive Disclosure: Split Editor */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Split className="w-4 h-4 text-purple-500" aria-hidden="true" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  将专注拆分为多个片段
                </span>
              </div>
              <input
                type="checkbox"
                id="enable-split"
                checked={isSplitEnabled}
                onChange={(e) => setIsSplitEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            {isSplitEnabled && (
              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700/60">
                <p className="text-[11px] text-zinc-500">
                  将连续专注切分为不同片段，分别分配给具体条目或置为未关联：
                </p>

                {draftSegments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-2 rounded-md border border-zinc-200 dark:border-zinc-700"
                  >
                    <span className="font-mono text-zinc-400 w-4 text-center">
                      #{idx + 1}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={totalMinutes}
                      aria-label={`片段 ${idx + 1} 时长`}
                      value={seg.minutes}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setSegments((prev) =>
                          prev.map((s) =>
                            s.id === seg.id ? { ...s, minutes: val } : s
                          )
                        );
                      }}
                      className="w-16 px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded bg-transparent font-mono text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                    <span className="text-zinc-500 text-[11px]">分钟</span>

                    <select
                      value={seg.entryId || ""}
                      aria-label={`片段 ${idx + 1} 归属条目`}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setSegments((prev) =>
                          prev.map((s) =>
                            s.id === seg.id ? { ...s, entryId: val } : s
                          )
                        );
                      }}
                      className="flex-1 px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded bg-transparent text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="">未关联 (无归属)</option>
                      {entries.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.title}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() =>
                        setSegments((prev) => prev.filter((s) => s.id !== seg.id))
                      }
                      aria-label="删除此片段"
                      className="text-zinc-400 hover:text-red-500 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      disabled={draftSegments.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setSegments((prev) => [
                      ...(prev.length > 0 ? prev : draftSegments),
                      {
                        id: `seg_draft_${Date.now()}`,
                        minutes: 15,
                        entryId: null,
                        note: "",
                      },
                    ])
                  }
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>添加片段</span>
                </button>
              </div>
            )}
          </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
          <Dialog.Close asChild>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              取消
            </button>
          </Dialog.Close>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>保存记录</span>
          </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
