"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { EntryPicker } from "@/components/entries/EntryPicker";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { useData } from "@/context/MockContext";
import { FocusSegment, FocusSession } from "@/lib/domain/types";
import { X, Split, Save, AlertCircle, Plus, Trash2 } from "lucide-react";

export type FocusSplitDraft = {
  id: string;
  seconds: number;
  entryId: string | null;
  note: string;
};

export const buildFocusSplitSegments = (
  drafts: FocusSplitDraft[],
  startedAt: string,
  endedAt: string,
): FocusSegment[] => {
  let currentPointerMs = new Date(startedAt).getTime();
  const endedAtMs = new Date(endedAt).getTime();

  return drafts.map((draft, index) => {
    const segmentStartMs = currentPointerMs;
    const segmentEndMs = index === drafts.length - 1
      ? endedAtMs
      : segmentStartMs + draft.seconds * 1000;
    currentPointerMs = segmentEndMs;

    return {
      id: draft.id,
      startedAt: new Date(segmentStartMs).toISOString(),
      endedAt: new Date(segmentEndMs).toISOString(),
      entryId: draft.entryId,
      note: draft.note || null,
    };
  });
};

export const FocusSplitModal: React.FC = () => {
  const { activeFocus, setIsSplitModalOpen } = useFocusTimer();

  if (!activeFocus) {
    return <Dialog.Root open={false} onOpenChange={setIsSplitModalOpen} />;
  }

  return <FocusSplitModalDialog key={activeFocus.id} activeFocus={activeFocus} />;
};

const FocusSplitModalDialog: React.FC<{ activeFocus: FocusSession }> = ({ activeFocus }) => {
  const { isSplitModalOpen, setIsSplitModalOpen, finishStopFocus, discardFocus, elapsedSeconds, formattedTime } =
    useFocusTimer();
  const { data } = useData();
  const entries = data.entries;

  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [segments, setSegments] = useState<FocusSplitDraft[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    () => activeFocus.segments[0]?.entryId ?? null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscardConfirming, setIsDiscardConfirming] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const totalSeconds = Math.max(1, elapsedSeconds);

  const isOpen = isSplitModalOpen;

  const draftSegments = segments.length > 0 ? segments : [{
    id: "seg_draft_default",
    seconds: totalSeconds,
    entryId: selectedEntryId,
    note: "",
  }];

  const handleSave = async () => {
    if (isSaving) return;
    setErrorMsg(null);

    let finalSegments: FocusSegment[] = [];
    const sessionStart = new Date(activeFocus.startedAt);
    const sessionEnd = new Date();

    if (isSplitEnabled) {
      const sumSeconds = draftSegments.reduce((acc, s) => acc + Number(s.seconds), 0);
      if (sumSeconds !== totalSeconds) {
        setErrorMsg(
          `SEGMENTS_INVALID_PARTITION: 片段时长之和 (${sumSeconds} 秒) 必须等于总专注时长 (${totalSeconds} 秒)！`
        );
        return;
      }

      finalSegments = buildFocusSplitSegments(draftSegments, sessionStart.toISOString(), sessionEnd.toISOString());
    } else {
      finalSegments = [
        {
          id: `seg_${Date.now()}_default`,
          startedAt: activeFocus.startedAt,
          endedAt: sessionEnd.toISOString(),
          entryId: selectedEntryId,
          note: note || null,
        },
      ];
    }

    setIsSaving(true);
    try {
      await finishStopFocus(outcome || null, note || null, finalSegments);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (isDiscarding) return;
    if (!isDiscardConfirming) {
      setErrorMsg(null);
      setIsDiscardConfirming(true);
      return;
    }

    setIsDiscarding(true);
    try {
      await discardFocus();
    } finally {
      setIsDiscarding(false);
    }
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
                  总时长：<strong className="text-blue-600 dark:text-blue-400 font-semibold tabular-nums">{formattedTime}</strong> ({totalSeconds} 秒)
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

          {!isSplitEnabled && (
            <div>
              <label htmlFor="focus-entry" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                关联条目
              </label>
              <EntryPicker
                id="focus-entry"
                value={selectedEntryId}
                entries={entries}
                onChange={setSelectedEntryId}
                ariaLabel="关联条目"
              />
            </div>
          )}

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
                      max={totalSeconds}
                      aria-label={`片段 ${idx + 1} 时长`}
                      value={seg.seconds}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setSegments((prev) =>
                          prev.map((s) =>
                            s.id === seg.id ? { ...s, seconds: val } : s
                          )
                        );
                      }}
                      className="w-16 px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded bg-transparent font-mono text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                    <span className="text-zinc-500 text-[11px]">秒</span>

                    <div className="min-w-0 flex-1">
                      <EntryPicker
                        id={`focus-segment-${seg.id}`}
                        value={seg.entryId}
                        entries={entries}
                        ariaLabel={`片段 ${idx + 1} 归属条目`}
                        compact
                        onChange={(val) => {
                          setSegments((prev) =>
                            prev.map((s) =>
                              s.id === seg.id ? { ...s, entryId: val } : s
                            )
                          );
                        }}
                      />
                    </div>

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
                        seconds: Math.min(15, totalSeconds),
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
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50">
          {isDiscardConfirming && (
            <div className="mr-auto min-w-0 text-[11px] text-red-700 dark:text-red-300">
              <p className="font-medium">确认放弃本次专注？</p>
              <p className="mt-0.5 text-red-600/80 dark:text-red-300/80">未保存的时间和片段将被删除。</p>
            </div>
          )}
          {!isDiscardConfirming && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving || isDiscarding}
              className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>放弃本次专注</span>
            </button>
          )}
          {isDiscardConfirming && (
            <>
              <button
                type="button"
                onClick={() => setIsDiscardConfirming(false)}
                disabled={isDiscarding}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                返回编辑
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isDiscarding}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isDiscarding ? "正在放弃..." : "确认放弃"}</span>
              </button>
            </>
          )}
          <Dialog.Close asChild>
            <button
              type="button"
              disabled={isDiscarding}
              className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
          </Dialog.Close>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isDiscarding || isDiscardConfirming}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isSaving ? "正在保存..." : "保存记录"}</span>
          </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
