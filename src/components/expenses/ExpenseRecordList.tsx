"use client";

import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Receipt } from "lucide-react";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/lib/domain/types";
import { getExpenseIcon } from "./expense-icons";
import {
  expenseAmountLabel,
  expenseOccurrenceLabel,
  expensePrimaryText,
  expenseReviewLabel,
  expenseDateGroupKey,
  formatExpenseDateGroupLabel,
  formatExpenseDateRangeLabel,
  groupExpensesByDate,
  type ExpenseDateGroup,
} from "./expense-utils";

const TAG_PREVIEW_LIMIT = 3;

type ExpenseRecordListProps = {
  dataTestId?: string;
  title: string;
  expenses: Expense[];
  selectedId: string | null;
  timezone: string;
  emptyLabel: string;
  onSelect: (id: string) => void;
  totalCount: number;
  totalCountLabel?: string;
  pageIndex?: number;
  pageCount?: number;
  onPageChange?: (pageIndex: number) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: string | null;
  onLoadMore?: () => void;
  categoryNames: ReadonlyMap<string, string>;
  paymentMethodNames: ReadonlyMap<string, string>;
  categoryIcons?: ReadonlyMap<string, ExpenseCategory["iconKey"]>;
  paymentMethodIcons?: ReadonlyMap<string, PaymentMethod["iconKey"]>;
  groupByDate?: boolean;
  summaryExpenses?: Expense[];
  renderExpanded?: (expense: Expense) => React.ReactNode;
};

export const previewExpenseTags = (expense: Pick<Expense, "tags">, limit = TAG_PREVIEW_LIMIT) => {
  const visibleTags = expense.tags.slice(0, Math.max(0, limit));
  return {
    visibleTags,
    hiddenCount: Math.max(0, expense.tags.length - visibleTags.length),
  };
};

const recordCategoryLabel = (expense: Expense, categoryNames: ReadonlyMap<string, string>) =>
  expense.categoryId
    ? categoryNames.get(expense.categoryId) ?? expense.categoryName ?? expense.categoryId
    : "未分类";

const recordPaymentMethodLabel = (
  expense: Expense,
  paymentMethodNames: ReadonlyMap<string, string>,
) =>
  expense.paymentMethodId
    ? paymentMethodNames.get(expense.paymentMethodId) ??
      expense.paymentMethodName ??
      expense.paymentMethodId
    : "未知/未填写";

const pageLabel = (pageIndex: number, pageCount: number, totalCount: number) =>
  `第 ${pageIndex + 1} / ${pageCount} 页 · 共 ${totalCount} 条`;

const getExpensePageRangeLabel = (expenses: Expense[], timezone: string) => {
  const dateKeys = expenses.map((expense) => expenseDateGroupKey(expense, timezone));
  const uniqueKeys = Array.from(new Set(dateKeys));
  const visibleKeys = uniqueKeys.filter((key) => key !== "unknown");
  if (visibleKeys.length === 0) return "日期未知";
  return formatExpenseDateRangeLabel(visibleKeys[visibleKeys.length - 1] ?? visibleKeys[0], visibleKeys[0]);
};

export const ExpenseRecordList: React.FC<ExpenseRecordListProps> = ({
  dataTestId,
  title,
  expenses,
  selectedId,
  timezone,
  emptyLabel,
  onSelect,
  totalCount,
  totalCountLabel,
  pageIndex = 0,
  pageCount = 1,
  onPageChange,
  hasMore = false,
  loadingMore = false,
  loadMoreError = null,
  onLoadMore,
  categoryNames,
  paymentMethodNames,
  categoryIcons,
  paymentMethodIcons,
  groupByDate = false,
  summaryExpenses,
  renderExpanded,
}) => {
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < pageCount - 1;
  const dateGroups = groupByDate ? groupExpensesByDate(expenses, timezone, summaryExpenses) : null;
  const pageRangeLabel = groupByDate && expenses.length > 0 ? getExpensePageRangeLabel(expenses, timezone) : null;

  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore || loadMoreError) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const root = document.getElementById("main-content");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { root, rootMargin: "0px 0px 480px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMoreError, loadingMore, onLoadMore]);

  const renderExpenseRow = (expense: Expense) => {
    const { visibleTags, hiddenCount } = previewExpenseTags(expense);
    const selected = expense.id === selectedId;
    const statusPending = expense.reviewStatus === "pending";

    return (
      <li key={expense.id} data-testid={`expense-row-${expense.id}`}>
        <button
          type="button"
          onClick={() => onSelect(expense.id)}
          aria-current={selected ? "true" : undefined}
          aria-expanded={renderExpanded ? selected : undefined}
          className={`block w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
            selected
              ? "bg-blue-50/70 dark:bg-blue-950/30"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <span className="truncate">{expensePrimaryText(expense)}</span>
              {expense.categoryId && (() => { const Icon = getExpenseIcon(categoryIcons?.get(expense.categoryId)); return <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />; })()}
            </span>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {expenseAmountLabel(expense)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{expenseOccurrenceLabel(expense, timezone)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">{expense.categoryId && (() => { const Icon = getExpenseIcon(categoryIcons?.get(expense.categoryId)); return <Icon className="h-3 w-3" aria-hidden="true" />; })()}{recordCategoryLabel(expense, categoryNames)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">{expense.paymentMethodId && (() => { const Icon = getExpenseIcon(paymentMethodIcons?.get(expense.paymentMethodId), "wallet"); return <Icon className="h-3 w-3" aria-hidden="true" />; })()}{recordPaymentMethodLabel(expense, paymentMethodNames)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                statusPending
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {expenseReviewLabel(expense.reviewStatus)}
            </span>
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                className="max-w-32 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                #{tag.name}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                +{hiddenCount}
              </span>
            )}
          </div>
        </button>
        {renderExpanded && selected && (
          <div className="border-t border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/20">
            {renderExpanded(expense)}
          </div>
        )}
      </li>
    );
  };

  const renderDateGroup = (group: ExpenseDateGroup, index: number) => (
    <li key={group.key} data-testid={`expense-date-group-${group.key}`}>
      <div
        className={`sticky top-0 z-10 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-zinc-200/80 bg-zinc-50 px-4 py-3 shadow-[0_1px_3px_rgba(24,24,27,0.06)] dark:border-zinc-800 dark:bg-zinc-900 ${
          index > 0 ? "border-t border-zinc-200/80 dark:border-zinc-800/80" : ""
        }`}
      >
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {formatExpenseDateGroupLabel(group.key)}
        </h3>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {group.totalCount} 笔 · {expenseAmountLabel({
            amountCents: group.totalAmountCents,
            currency: group.currency,
          })}
        </span>
      </div>
      <ul
        className="divide-y divide-zinc-100 dark:divide-zinc-800/80"
        aria-label={formatExpenseDateGroupLabel(group.key)}
      >
        {group.expenses.map(renderExpenseRow)}
      </ul>
    </li>
  );

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      data-testid={dataTestId}
      aria-labelledby={dataTestId ? `${dataTestId}-heading` : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2">
          <Receipt className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <h2
            id={dataTestId ? `${dataTestId}-heading` : undefined}
            className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {title}
          </h2>
        </div>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {totalCountLabel ?? `${totalCount} 条`}
        </span>
      </div>

      {expenses.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <Receipt className="h-5 w-5 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>
        </div>
      ) : dateGroups ? (
        <ul className="space-y-1" aria-label={title}>
          {dateGroups.map(renderDateGroup)}
        </ul>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80" aria-label={title}>
          {expenses.map(renderExpenseRow)}
        </ul>
      )}

      {onLoadMore && expenses.length > 0 && (
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div ref={loadMoreSentinelRef} data-testid="expense-load-more-sentinel" aria-hidden="true" />
          <div className="flex min-h-8 items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {loadingMore ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span role="status">加载更早记录...</span>
              </>
            ) : loadMoreError ? (
              <>
                <span role="alert">{loadMoreError}</span>
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  重试加载
                </button>
              </>
            ) : hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                className="rounded-md px-2 py-1 font-medium text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:bg-blue-950/40"
              >
                加载更多
              </button>
            ) : (
              <span>已经看到最早的记录</span>
            )}
          </div>
          <div aria-hidden="true" className="h-1" />
        </div>
      )}

      {!onLoadMore && pageCount > 1 && (
        <nav
          className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
          aria-label={`${title}分页`}
        >
          <div className="min-w-0">
            <div className="truncate text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {pageRangeLabel ?? pageLabel(pageIndex, pageCount, totalCount)}
            </div>
            <div className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {pageLabel(pageIndex, pageCount, totalCount)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(pageIndex - 1)}
              disabled={!canGoPrevious}
              aria-label="上一页"
              title="上一页"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange?.(pageIndex + 1)}
              disabled={!canGoNext}
              aria-label="下一页"
              title="下一页"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
};
