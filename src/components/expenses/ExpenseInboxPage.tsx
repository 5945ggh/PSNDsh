"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/context/MockContext";
import { Expense, ExpenseCategory, PaymentMethod } from "@/lib/domain/types";
import {
  DEFAULT_TIMEZONE,
  formatDateLabelInTimezone,
  formatDateKeyInTimezone,
  localDateTimeToIso,
} from "@/lib/time/timezone";
import {
  ArrowRight,
  Copy,
  Inbox,
  ListChecks,
  Save,
  SkipForward,
} from "lucide-react";
import { ExpenseRecordList } from "./ExpenseRecordList";

type ExpenseDraft = {
  amount: string;
  occurrenceMode: "datetime" | "date";
  occurredAt: string;
  occurredOn: string;
  note: string;
  categoryId: string;
  paymentMethodId: string;
  tagIds: string[];
};

const formatLocalDateTime = (value: string | null, timezone: string) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const draftFromExpense = (expense: Expense, timezone: string): ExpenseDraft => ({
  amount: (expense.amountCents / 100).toFixed(2),
  occurrenceMode: expense.occurrencePrecision,
  occurredAt: formatLocalDateTime(expense.occurredAt ?? expense.recordedAt, timezone),
  occurredOn: expense.occurredOn ?? formatDateKeyInTimezone(expense.occurredAt ?? expense.recordedAt, timezone),
  note: expense.note ?? "",
  categoryId: expense.categoryId ?? "",
  paymentMethodId: expense.paymentMethodId ?? "",
  tagIds: expense.tags.map((tag) => tag.id),
});

const normalizeCurrencyAmount = (value: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("金额必须为正数");
  }
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("金额必须为正数");
  }
  return cents;
};

const recordLabel = (expense: Expense) => expense.note?.trim() || expense.captureMessage || "未填写备注";

const mapById = <T extends { id: string; name: string }>(items: T[]) =>
  new Map(items.map((item) => [item.id, item.name] as const));

export const ExpenseInboxPage: React.FC = () => {
  const { api, data, mutate, pendingMutations } = useData();
  const timezone = data.capabilities?.effectiveTimezone ?? DEFAULT_TIMEZONE;
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"pending" | "all">("pending");
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryNames = useMemo(() => mapById(data.expenseCategories), [data.expenseCategories]);
  const paymentMethodNames = useMemo(() => mapById(data.paymentMethods), [data.paymentMethods]);
  const tagNames = useMemo(() => mapById(data.expenseTags), [data.expenseTags]);

  const expensesById = useMemo(
    () => new Map(data.expenses.map((expense) => [expense.id, expense] as const)),
    [data.expenses]
  );

  const selectedExpense = selectedId ? expensesById.get(selectedId) ?? null : null;
  const pendingOrder = data.inboxExpenses;
  const allOrder = data.expenses;
  const activeOrder = view === "pending" ? pendingOrder : allOrder;
  const pendingCount = pendingOrder.length;
  const unclassifiedCount = allOrder.filter((expense) => expense.categoryId === null).length;

  useEffect(() => {
    const nextSelected =
      (selectedId && activeOrder.some((expense) => expense.id === selectedId) ? selectedId : null) ??
      activeOrder[0]?.id ??
      null;
    if (nextSelected !== selectedId) {
      // Keep local selection valid when queue data changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(nextSelected);
    }
  }, [activeOrder, allOrder, expensesById, pendingOrder, selectedId]);

  useEffect(() => {
    if (!selectedExpense) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(null);
      return;
    }
    setDraft(draftFromExpense(selectedExpense, timezone));
    setError(null);
  }, [selectedExpense, timezone]);

  const chooseNextId = (source: Expense[]) => {
    if (!selectedExpense) return source[0]?.id ?? null;
    const index = source.findIndex((expense) => expense.id === selectedExpense.id);
    return source[index + 1]?.id ?? source[index - 1]?.id ?? selectedExpense.id;
  };

  const updateDraft = (patch: Partial<ExpenseDraft>) => {
    setError(null);
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const submitExpense = async (keepAsIs: boolean) => {
    if (!selectedExpense || !draft) return;

    try {
      if (keepAsIs) {
        await mutate(() => api.updateExpense(selectedExpense.id, { reviewStatus: "reviewed" }));
      } else {
        let amountCents: number;
        try {
          amountCents = normalizeCurrencyAmount(draft.amount);
        } catch (validationError) {
          setError(validationError instanceof Error ? validationError.message : "金额无效");
          return;
        }

        const update: Record<string, unknown> = {
          amountCents,
          note: draft.note.trim() || null,
          categoryId: draft.categoryId || null,
          paymentMethodId: draft.paymentMethodId || null,
          tagIds: draft.tagIds,
          reviewStatus: "reviewed",
        };

        if (draft.occurrenceMode === "date") {
          if (!draft.occurredOn) {
            setError("请选择发生日期");
            return;
          }
          update.occurrencePrecision = "date";
          update.occurredOn = draft.occurredOn;
        } else {
          const iso = localDateTimeToIso(draft.occurredAt, timezone);
          if (!iso) {
            setError("请选择发生时间");
            return;
          }
          update.occurrencePrecision = "datetime";
          update.occurredAt = iso;
        }

        await mutate(() => api.updateExpense(selectedExpense.id, update as Parameters<typeof api.updateExpense>[1]));
      }
      const currentQueue = pendingOrder.some((expense) => expense.id === selectedExpense.id) ? pendingOrder : allOrder;
      const nextId = chooseNextId(currentQueue);
      setSelectedId(nextId);
      setError(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "保存失败");
    }
  };

  const skipExpense = () => {
    if (!selectedExpense) return;
    const currentQueue = pendingOrder.some((expense) => expense.id === selectedExpense.id) ? pendingOrder : allOrder;
    const nextId = chooseNextId(currentQueue);
    setSelectedId(nextId);
  };

  const copyCaptureToNote = () => {
    if (!selectedExpense?.captureMessage) return;
    updateDraft({ note: selectedExpense.captureMessage });
    window.setTimeout(() => noteRef.current?.focus(), 0);
  };

  const handleInboxKeyDown = (event: React.KeyboardEvent) => {
    if (!selectedExpense) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = activeOrder.findIndex((expense) => expense.id === selectedExpense.id);
    if (index < 0) {
      setSelectedId(activeOrder[0]?.id ?? selectedExpense.id);
      return;
    }
    const next = event.key === "ArrowDown"
      ? activeOrder[index + 1]?.id ?? activeOrder[index].id
      : activeOrder[index - 1]?.id ?? activeOrder[index].id;
    setSelectedId(next);
  };

  const selectedTagNames = selectedExpense ? selectedExpense.tags.map((tag) => tagNames.get(tag.id) ?? tag.name) : [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Inbox className="h-4 w-4 text-blue-500" aria-hidden="true" />
              <span>账目</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              账目工作台
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              待整理记录、全部记录和整理操作集中在同一页。未分类只是内容状态，不代表记录无效。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
              待整理 {pendingCount}
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
              未分类 {unclassifiedCount}
            </span>
          </div>
        </div>
      </section>

      <div className="flex border-b border-zinc-200 dark:border-zinc-800" role="tablist" aria-label="账目视图">
        <button type="button" role="tab" aria-selected={view === "pending"} onClick={() => setView("pending")} className={`border-b-2 px-4 py-2.5 text-sm font-medium ${view === "pending" ? "border-blue-600 text-blue-700" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>待整理 <span className="ml-1 font-mono text-xs">{pendingCount}</span></button>
        <button type="button" role="tab" aria-selected={view === "all"} onClick={() => setView("all")} className={`border-b-2 px-4 py-2.5 text-sm font-medium ${view === "all" ? "border-blue-600 text-blue-700" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>全部记录 <span className="ml-1 font-mono text-xs">{allOrder.length}</span></button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <div
          className="space-y-4"
          tabIndex={0}
          aria-label="待整理列表"
          onKeyDown={handleInboxKeyDown}
          data-testid="expense-inbox-column"
        >
          <ExpenseRecordList
            expenses={activeOrder}
            selectedId={selectedExpense?.id ?? null}
            onSelect={setSelectedId}
            title={view === "pending" ? "待整理" : "全部记录"}
            emptyLabel={view === "pending" ? "没有待整理记录。" : "暂无开销记录。"}
            timezone={timezone}
            dataTestId={view === "pending" ? "expense-inbox-list" : "expense-all-list"}
            categoryNames={categoryNames}
            paymentMethodNames={paymentMethodNames}
            totalCount={activeOrder.length}
            pageIndex={0}
            pageCount={1}
            onPageChange={() => undefined}
          />

        </div>

        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" data-testid="expense-editor">
          {selectedExpense && draft ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{recordLabel(selectedExpense)}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    记录时间 {formatDateLabelInTimezone(selectedExpense.recordedAt, timezone)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                    {selectedExpense.reviewStatus === "reviewed" ? "已整理" : "待整理"}
                  </span>
                  <span className="rounded-full border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                    {selectedExpense.categoryId ? categoryNames.get(selectedExpense.categoryId) ?? selectedExpense.categoryId : "未分类"}
                  </span>
                  <span className="rounded-full border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                    {selectedExpense.paymentMethodId ? paymentMethodNames.get(selectedExpense.paymentMethodId) ?? selectedExpense.paymentMethodId : "未填写"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    金额
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={draft.amount}
                    onChange={(event) => updateDraft({ amount: event.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                  />
                </label>

                <label className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    发生方式
                  </span>
                  <select
                    value={draft.occurrenceMode}
                    onChange={(event) => updateDraft({ occurrenceMode: event.target.value as ExpenseDraft["occurrenceMode"] })}
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                  >
                    <option value="datetime">日期和时间</option>
                    <option value="date">仅日期</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {draft.occurrenceMode === "datetime" ? (
                  <label className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 md:col-span-2">
                    <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      发生时间
                    </span>
                    <input
                      type="datetime-local"
                      value={draft.occurredAt}
                      onChange={(event) => updateDraft({ occurredAt: event.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                    />
                  </label>
                ) : (
                  <label className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 md:col-span-2">
                    <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      发生日期
                    </span>
                    <input
                      type="date"
                      value={draft.occurredOn}
                      onChange={(event) => updateDraft({ occurredOn: event.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                    />
                  </label>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    分类
                  </span>
                  <select
                    value={draft.categoryId}
                    onChange={(event) => updateDraft({ categoryId: event.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                  >
                    <option value="">未分类</option>
                    {data.expenseCategories.map((category: ExpenseCategory) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    支付方式
                  </span>
                  <select
                    value={draft.paymentMethodId}
                    onChange={(event) => updateDraft({ paymentMethodId: event.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                  >
                    <option value="">未填写</option>
                    {data.paymentMethods.map((method: PaymentMethod) => (
                      <option key={method.id} value={method.id}>{method.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  备注
                </span>
                <textarea
                  ref={noteRef}
                  rows={4}
                  value={draft.note}
                  onChange={(event) => updateDraft({ note: event.target.value })}
                  className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                />
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">标签</span>
                  {selectedTagNames.length > 0 && (
                    <span className="text-[11px] text-zinc-500">{selectedTagNames.join(" · ")}</span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.expenseTags.map((tag) => {
                    const checked = draft.tagIds.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className={[
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                          checked
                            ? "border-blue-300 bg-blue-50 text-zinc-900 dark:border-blue-700 dark:bg-blue-950/30 dark:text-zinc-100"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            updateDraft({
                              tagIds: event.target.checked
                                ? [...draft.tagIds, tag.id]
                                : draft.tagIds.filter((item) => item !== tag.id),
                            });
                          }}
                        />
                        <span>{tag.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                    捕获留言
                  </div>
                  <button
                    type="button"
                    onClick={copyCaptureToNote}
                    disabled={!selectedExpense.captureMessage}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>复制为备注</span>
                  </button>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {selectedExpense.captureMessage || "没有捕获留言。"}
                </p>
              </div>

              {error && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  {error}
                </p>
              )}

              <div className="grid gap-2 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => void submitExpense(true)}
                  disabled={pendingMutations > 0}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>{pendingMutations > 0 ? "保存中..." : "保存并下一条"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void submitExpense(false)}
                  disabled={pendingMutations > 0}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-950/40"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  <span>保留原样并下一条</span>
                </button>

                <button
                  type="button"
                  onClick={skipExpense}
                  disabled={pendingMutations > 0}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-950/40"
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                  <span>跳过</span>
                </button>
              </div>
            </>
          ) : (
            <div className="grid min-h-[24rem] place-items-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
              暂无可整理的开销记录。
            </div>
          )}
        </section>
      </section>
    </div>
  );
};
