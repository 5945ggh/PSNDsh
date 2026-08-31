"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { type DataSnapshot, useData } from "@/context/MockContext";
import type { Entry, EntryCompletionMode, WeekPlan } from "@/lib/domain/types";
import { dateKeyToEndOfDayIso } from "@/lib/time/timezone";

type CreatedEntryResult = {
  entry: Entry;
  weekPlan: WeekPlan | null;
};

type EntryCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addToWeekPlan?: boolean;
  title?: string;
  description?: string;
};

export const mergeCreatedEntry = (
  snapshot: DataSnapshot,
  result: CreatedEntryResult
): DataSnapshot => ({
  ...snapshot,
  entries: [...snapshot.entries.filter((entry) => entry.id !== result.entry.id), result.entry],
  ...(result.weekPlan ? { currentWeekPlan: result.weekPlan } : {}),
});

export const EntryCreateDialog: React.FC<EntryCreateDialogProps> = ({
  open,
  onOpenChange,
  addToWeekPlan = false,
  title = "新建顶层条目",
  description = "创建后仍会留在当前计划树中，方便继续整理。",
}) => {
  const { api, mutate } = useData();
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newMode, setNewMode] = useState<EntryCompletionMode>("completable");
  const [newDueAt, setNewDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = newTitle.trim();
    if (!normalizedTitle || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await mutate(async () => {
        const entry = await api.addEntry({
          parentId: null,
          title: normalizedTitle,
          description: newDescription.trim() || null,
          completionMode: newMode,
          dueAt: dateKeyToEndOfDayIso(newDueAt),
        });
        const weekPlan = addToWeekPlan ? await api.addToWeekPlan(entry.id) : null;
        return { entry, weekPlan };
      }, {
        backgroundRefresh: true,
        update: mergeCreatedEntry,
      });
      setNewTitle("");
      setNewDescription("");
      setNewMode("completable");
      setNewDueAt("");
      onOpenChange(false);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "创建条目失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <Dialog.Title asChild>
                <h2 className="font-semibold text-base">{title}</h2>
              </Dialog.Title>
              <p className="mt-1 text-xs text-zinc-500">{description}</p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="关闭新建条目对话框"
                title="关闭"
                className="rounded p-1 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
            {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

            <div>
              <label htmlFor="entry-create-title" className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                条目标题
              </label>
              <input
                id="entry-create-title"
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="例如：算法练习 / 论文阅读"
                className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="entry-create-description" className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                描述 / 备注
              </label>
              <textarea
                id="entry-create-description"
                rows={3}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="记录这个条目的背景、下一步或完成标准"
                className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="entry-create-mode" className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                  完成模式
                </label>
                <select
                  id="entry-create-mode"
                  value={newMode}
                  onChange={(event) => setNewMode(event.target.value as EntryCompletionMode)}
                  className="w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
                >
                  <option value="completable">可完成型 (待办)</option>
                  <option value="ongoing">持续型 (长期方向)</option>
                </select>
              </div>
              <div>
                <label htmlFor="entry-create-due" className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                  截止日期
                </label>
                <input
                  id="entry-create-due"
                  type="date"
                  value={newDueAt}
                  onChange={(event) => setNewDueAt(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Dialog.Close asChild>
                <button type="button" className="rounded-md border border-zinc-300 px-3.5 py-2 font-medium text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  取消
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3.5 py-2 font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {isSubmitting ? "创建中…" : addToWeekPlan ? "创建并加入本周" : "创建条目"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
