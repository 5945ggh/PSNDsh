"use client";

import React from "react";
import type { Expense, ExpenseCategory, ExpenseTag, PaymentMethod } from "@/lib/domain/types";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Save,
  SkipForward,
} from "lucide-react";
import {
  expenseAmountLabel,
  expenseCategoryLabel,
  expenseOccurrenceLabel,
  expensePaymentMethodLabel,
  expensePrimaryText,
  expenseRecordedLabel,
  expenseReviewLabel,
  ExpenseDraft,
} from "./expense-utils";

type ExpenseRecordFormProps = {
  expense: Expense | null;
  draft: ExpenseDraft;
  categories: ExpenseCategory[];
  tags: ExpenseTag[];
  paymentMethods: PaymentMethod[];
  timezone: string;
  mode: "inbox" | "expenses";
  queuePosition: number;
  queueLength: number;
  pending: boolean;
  errorMessage: string | null;
  statusMessage: string | null;
  dataTestId?: string;
  onDraftChange: (next: ExpenseDraft) => void;
  onCopyCaptureMessage: () => void;
  onSelectPrevious: () => void;
  onSelectNext: () => void;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  onSkip?: () => void;
};

const actionClass =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export const ExpenseRecordForm: React.FC<ExpenseRecordFormProps> = ({
  expense,
  draft,
  categories,
  tags,
  paymentMethods,
  timezone,
  mode,
  queuePosition,
  queueLength,
  pending,
  errorMessage,
  statusMessage,
  dataTestId = "expense-detail-panel",
  onDraftChange,
  onCopyCaptureMessage,
  onSelectPrevious,
  onSelectNext,
  onPrimaryAction,
  onSecondaryAction,
  onSkip,
}) => {
  if (!expense) {
    return (
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {mode === "inbox" ? "太棒了，所有开销均已整理完毕！" : "还没有开销记录。"}
            </h2>
          </div>
        </div>
      </section>
    );
  }

  const currentCategoryExists =
    draft.categoryId === "" || categories.some((category) => category.id === draft.categoryId);
  const currentPaymentMethodExists =
    draft.paymentMethodId === "" ||
    paymentMethods.some((method) => method.id === draft.paymentMethodId);

  return (
    <section
      aria-labelledby="expense-detail-heading"
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      data-testid={dataTestId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="expense-detail-heading"
              className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {expenseAmountLabel(expense)}
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                expense.reviewStatus === "reviewed"
                  ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {expenseReviewLabel(expense.reviewStatus)}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
              {queuePosition} / {queueLength}
            </span>
          </div>

          {(expense.note?.trim() || !expense.captureMessage?.trim()) && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {expensePrimaryText(expense)}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            {expenseOccurrenceLabel(expense, timezone)} · {expenseRecordedLabel(expense, timezone)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectPrevious}
            disabled={queueLength <= 1 || pending}
            aria-label="上一条记录"
            title="上一条记录"
            className={`${actionClass} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onSelectNext}
            disabled={queueLength <= 1 || pending}
            aria-label="下一条记录"
            title="下一条记录"
            className={`${actionClass} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800`}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">捕获留言</p>
            <p className="leading-6">
              {expense.captureMessage?.trim() || "没有捕获留言。"}
            </p>
          </div>

          {expense.captureMessage?.trim() && (
            <button
              type="button"
              onClick={onCopyCaptureMessage}
              className={`${actionClass} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800`}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>复制为备注</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
          <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400">金额</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={(draft.amountCents / 100).toFixed(2)}
              onChange={(event) => {
                const amount = Number.parseFloat(event.target.value);
                onDraftChange({
                  ...draft,
                  amountCents: Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0,
                });
              }}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950/30"
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400">发生精度</span>
            <select
              value={draft.occurrencePrecision}
              onChange={(event) => {
                const occurrencePrecision = event.target.value as "datetime" | "date";
                onDraftChange({
                  ...draft,
                  occurrencePrecision,
                  ...(occurrencePrecision === "date"
                    ? {
                        occurredOn: draft.occurredOn || draft.occurredAt.slice(0, 10) || expense.occurredOn || "",
                      }
                    : {
                        occurredAt:
                          draft.occurredAt ||
                          expense.occurredAt?.slice(0, 16) ||
                          (draft.occurredOn ? `${draft.occurredOn}T00:00` : ""),
                      }),
                });
              }}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950/30"
            >
              <option value="datetime">日期 + 时间</option>
              <option value="date">只有日期</option>
            </select>
          </label>

          {draft.occurrencePrecision === "date" ? (
            <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400">发生日期</span>
              <input
                type="date"
                value={draft.occurredOn}
                onChange={(event) => onDraftChange({ ...draft, occurredOn: event.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950/30"
              />
            </label>
          ) : (
            <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400">发生时间</span>
              <input
                type="datetime-local"
                value={draft.occurredAt}
                onChange={(event) => onDraftChange({ ...draft, occurredAt: event.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950/30"
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
          <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400">分类</span>
            <select
              value={draft.categoryId}
              onChange={(event) => onDraftChange({ ...draft, categoryId: event.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950/30"
            >
              <option value="">未分类</option>
              {!currentCategoryExists && expense.categoryId && (
                <option value={expense.categoryId}>当前分类已归档</option>
              )}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400">支付方式</span>
            <select
              value={draft.paymentMethodId}
              onChange={(event) =>
                onDraftChange({ ...draft, paymentMethodId: event.target.value })
              }
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950/30"
            >
              <option value="">未知/未填写</option>
              {!currentPaymentMethodExists && expense.paymentMethodId && (
                <option value={expense.paymentMethodId}>当前支付方式已归档</option>
              )}
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 md:col-span-2">
          <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400">备注</span>
          <textarea
            value={draft.note}
            onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
            rows={4}
            placeholder="可留空，支持把捕获留言复制过来后继续整理。"
            className="min-h-[7.5rem] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950/30 dark:placeholder:text-zinc-500"
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-[0.18em] text-zinc-400">标签</legend>
        {tags.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-800">
            暂无可选标签。
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {tags.map((tag) => {
              const checked = draft.tagIds.includes(tag.id);
              return (
                <label
                  key={tag.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200"
                      : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        tagIds: event.target.checked
                          ? [...draft.tagIds, tag.id]
                          : draft.tagIds.filter((id) => id !== tag.id),
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{tag.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        {mode === "inbox" ? (
          <>
            <button
              type="button"
              onClick={onPrimaryAction}
              disabled={pending}
              className={`${actionClass} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>保存并下一条</span>
            </button>
            <button
              type="button"
              onClick={onSecondaryAction}
              disabled={pending}
              className={`${actionClass} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800`}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>保留原样并下一条</span>
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={pending}
              className={`${actionClass} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800`}
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
              <span>跳过</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={pending}
            className={`${actionClass} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>保存修改</span>
          </button>
        )}
      </div>

      <div className="space-y-1 text-xs text-zinc-500">
        <p>
          分类：{expenseCategoryLabel(expense, categories)} · 支付方式：
          {expensePaymentMethodLabel(expense, paymentMethods)}
        </p>
        <p>
          当前整理状态：{expenseReviewLabel(expense.reviewStatus)}。
        </p>
      </div>

      {statusMessage && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {statusMessage}
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </p>
      )}
    </section>
  );
};
