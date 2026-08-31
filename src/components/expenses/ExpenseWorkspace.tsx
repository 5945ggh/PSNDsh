"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Inbox, Receipt } from "lucide-react";
import { useData, type DataSnapshot } from "@/context/MockContext";
import type { Expense } from "@/lib/domain/types";
import { ExpenseRecordForm } from "./ExpenseRecordForm";
import { ExpenseRecordList } from "./ExpenseRecordList";
import {
  buildExpenseUpdateInput,
  copyCaptureMessageToDraft,
  seedExpenseDraft,
  sortExpensesForHistory,
  type ExpenseDraft,
} from "./expense-utils";

type ExpenseWorkspaceMode = "inbox" | "expenses";

export const EXPENSE_PAGE_SIZE = 25;

export const getExpensePageCount = (total: number, pageSize = EXPENSE_PAGE_SIZE) =>
  Math.max(1, Math.ceil(total / pageSize));

export const getExpensePageIndex = (index: number, pageSize = EXPENSE_PAGE_SIZE) =>
  Math.max(0, Math.floor(index / pageSize));

export const getExpensePageSlice = <T,>(items: T[], pageIndex: number, pageSize = EXPENSE_PAGE_SIZE) =>
  items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

export const getExpenseKeyboardDirection = (key: string): -1 | 0 | 1 => {
  if (key === "ArrowLeft") return -1;
  if (key === "ArrowRight") return 1;
  return 0;
};

export const getExpenseWorkspaceInitialSelection = (mode: ExpenseWorkspaceMode, records: Expense[]) =>
  mode === "inbox" ? records[0]?.id ?? null : null;

export const updateSnapshotWithExpense = (snapshot: DataSnapshot, expense: Expense): DataSnapshot => {
  const replace = (records: Expense[]) =>
    records.some((item) => item.id === expense.id)
      ? records.map((item) => (item.id === expense.id ? expense : item))
      : records;

  return {
    ...snapshot,
    expenses: replace(snapshot.expenses),
    inboxExpenses:
      expense.reviewStatus === "pending"
        ? replace(snapshot.inboxExpenses)
        : snapshot.inboxExpenses.filter((item) => item.id !== expense.id),
  };
};

export const ExpenseWorkspace: React.FC<{ mode: ExpenseWorkspaceMode }> = ({ mode }) => {
  const { api, data, mutate, pendingMutations, loadMoreExpenses } = useData();
  const records = mode === "inbox" ? data.inboxExpenses : data.expenses;
  const timezone = data.capabilities?.effectiveTimezone ?? "Asia/Shanghai";
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    getExpenseWorkspaceInitialSelection(mode, records),
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [draft, setDraft] = useState<ExpenseDraft>(() => seedExpenseDraft(null));
  const [draftRecordId, setDraftRecordId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const inlineScrollTop = useRef<number | null>(null);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    // Loading feedback belongs to the history view instance, not the shared workspace shell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadMoreError(null);
  }, [mode]);

  const pageCount = getExpensePageCount(records.length);
  const visiblePageIndex = Math.min(pageIndex, pageCount - 1);
  const orderedRecords = useMemo(
    () => (mode === "expenses" ? sortExpensesForHistory(records, timezone) : records),
    [mode, records, timezone],
  );
  const pageRecords = mode === "expenses"
    ? orderedRecords
    : getExpensePageSlice(orderedRecords, visiblePageIndex);
  const selectedRecord = orderedRecords.find((item) => item.id === selectedId) ?? null;
  const current = mode === "inbox" ? selectedRecord ?? orderedRecords[0] ?? null : selectedRecord;
  const usesInlineDetail = mode === "expenses" || isMobile;
  const currentIndex = current ? orderedRecords.findIndex((item) => item.id === current.id) : -1;
  const currentDraft = current && draftRecordId === current.id ? draft : seedExpenseDraft(current);
  const pending = pendingMutations > 0 || isSubmitting;
  const categories = data.expenseCategories;
  const tags = data.expenseTags;
  const paymentMethods = data.paymentMethods;
  const categoryNames = useMemo(() => new Map(categories.map((item) => [item.id, item.name] as const)), [categories]);
  const paymentMethodNames = useMemo(
    () => new Map(paymentMethods.map((item) => [item.id, item.name] as const)),
    [paymentMethods],
  );

  const preserveInlineScrollPosition = useCallback(() => {
    if ((mode === "expenses" || isMobile) && typeof window !== "undefined") {
      const mainContent = document.getElementById("main-content");
      inlineScrollTop.current = mainContent?.scrollTop ?? window.scrollY;
    }
  }, [isMobile, mode]);

  useLayoutEffect(() => {
    if (inlineScrollTop.current === null || typeof window === "undefined") return;
    const mainContent = document.getElementById("main-content");
    if (mainContent) {
      mainContent.scrollTop = inlineScrollTop.current;
    } else {
      window.scrollTo({ top: inlineScrollTop.current, left: window.scrollX, behavior: "auto" });
    }
    inlineScrollTop.current = null;
  }, [draft, errorMessage, isSubmitting, pageIndex, selectedId, statusMessage]);

  const selectRecord = useCallback(
    (id: string) => {
      if (submitInFlightRef.current) return;
      const index = orderedRecords.findIndex((item) => item.id === id);
      if (index < 0) return;
      const nextRecord = orderedRecords[index];
      preserveInlineScrollPosition();
      setSelectedId(id);
      setDraftRecordId(id);
      setDraft(seedExpenseDraft(nextRecord));
      setPageIndex(getExpensePageIndex(index));
      setErrorMessage(null);
      setStatusMessage(null);
    },
    [orderedRecords, preserveInlineScrollPosition],
  );

  const toggleRecord = useCallback(
    (id: string) => {
      if (submitInFlightRef.current) return;
      if ((mode === "expenses" || isMobile) && id === selectedId) {
        preserveInlineScrollPosition();
        setSelectedId(null);
        setDraftRecordId(null);
        setErrorMessage(null);
        setStatusMessage(null);
        return;
      }
      selectRecord(id);
    },
    [isMobile, mode, preserveInlineScrollPosition, selectRecord, selectedId],
  );

  const handleDraftChange = useCallback(
    (next: ExpenseDraft) => {
      preserveInlineScrollPosition();
      setDraftRecordId(current?.id ?? null);
      setDraft(next);
      setErrorMessage(null);
    },
    [current?.id, preserveInlineScrollPosition],
  );

  const moveSelection = useCallback(
    (delta: number) => {
      if (submitInFlightRef.current) return;
      if (!current || orderedRecords.length === 0) return;
      const index = orderedRecords.findIndex((item) => item.id === current.id);
      const nextIndex = Math.max(0, Math.min(orderedRecords.length - 1, index + delta));
      const nextRecord = orderedRecords[nextIndex];
      if (nextRecord) selectRecord(nextRecord.id);
    },
    [current, orderedRecords, selectRecord],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!current || submitInFlightRef.current || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const direction = getExpenseKeyboardDirection(event.key);
      if (direction === 0) return;
      event.preventDefault();
      moveSelection(direction);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, moveSelection]);

  const chooseNextInboxRecord = useCallback(() => {
    if (!current) return null;
    const index = orderedRecords.findIndex((item) => item.id === current.id);
    return orderedRecords[index + 1] ?? orderedRecords[index - 1] ?? null;
  }, [current, orderedRecords]);

  const submitCurrent = useCallback(
    async (completeAfterSave = false) => {
      if (!current) return;
      if (submitInFlightRef.current) return;
      submitInFlightRef.current = true;
      const nextInboxRecord = mode === "inbox" ? chooseNextInboxRecord() : null;
      preserveInlineScrollPosition();
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const input =
          mode === "inbox"
            ? {
                ...buildExpenseUpdateInput(currentDraft, completeAfterSave ? "reviewed" : "pending"),
                reviewStatus: completeAfterSave ? ("reviewed" as const) : ("pending" as const),
              }
              : buildExpenseUpdateInput(currentDraft);

        await mutate(
          () => api.updateExpense(current.id, input),
          {
            update: (snapshot, updated) => updateSnapshotWithExpense(snapshot, updated),
          },
        );

        if (mode === "inbox" && completeAfterSave) {
          setSelectedId(nextInboxRecord?.id ?? null);
          setDraftRecordId(nextInboxRecord?.id ?? null);
          setDraft(seedExpenseDraft(nextInboxRecord));
          if (nextInboxRecord) {
            const nextIndex = records.findIndex((item) => item.id === nextInboxRecord.id);
            setPageIndex(getExpensePageIndex(nextIndex));
          }
        } else {
          setDraftRecordId(current.id);
        }

        preserveInlineScrollPosition();
        setStatusMessage(
          mode === "inbox"
            ? completeAfterSave
              ? "已保存并标记为已整理，进入下一条。"
              : "已保存更改，仍保留在待整理。"
            : "已保存修改。",
        );
      } catch (error) {
        preserveInlineScrollPosition();
        setErrorMessage(error instanceof Error ? error.message : "保存失败");
      } finally {
        preserveInlineScrollPosition();
        setIsSubmitting(false);
        submitInFlightRef.current = false;
      }
    },
    [api, chooseNextInboxRecord, current, currentDraft, mode, mutate, preserveInlineScrollPosition, records],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, nextPage));
      preserveInlineScrollPosition();
      setPageIndex(clamped);
      if (mode === "expenses" || isMobile) {
        setSelectedId(null);
        setDraftRecordId(null);
        setErrorMessage(null);
        setStatusMessage(null);
        return;
      }

      const nextRecord = orderedRecords[clamped * EXPENSE_PAGE_SIZE] ?? null;
      setSelectedId(nextRecord?.id ?? null);
      setDraftRecordId(nextRecord?.id ?? null);
      setDraft(seedExpenseDraft(nextRecord));
      setErrorMessage(null);
      setStatusMessage(null);
    },
    [isMobile, mode, orderedRecords, pageCount, preserveInlineScrollPosition],
  );

  const handleLoadMore = useCallback(async () => {
    if (mode !== "expenses" || isLoadingMore || !data.expensesHasMore) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      await loadMoreExpenses();
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "加载更早记录失败");
    } finally {
      setIsLoadingMore(false);
    }
  }, [data.expensesHasMore, isLoadingMore, loadMoreExpenses, mode]);

  const list = (
    <ExpenseRecordList
      dataTestId="expense-record-list"
      title={mode === "inbox" ? "待整理队列" : "全部记录"}
      expenses={pageRecords}
      selectedId={selectedId}
      timezone={timezone}
      emptyLabel={mode === "inbox" ? "Inbox 已清空，新的捕获会自动出现在这里。" : "当前账号还没有开销记录。"}
      onSelect={toggleRecord}
      totalCount={records.length}
      totalCountLabel={mode === "expenses" ? `已加载 ${records.length} 条` : undefined}
      pageIndex={mode === "inbox" ? visiblePageIndex : undefined}
      pageCount={mode === "inbox" ? pageCount : undefined}
      onPageChange={mode === "inbox" ? handlePageChange : undefined}
      hasMore={mode === "expenses" ? data.expensesHasMore : undefined}
      loadingMore={mode === "expenses" ? isLoadingMore : undefined}
      loadMoreError={mode === "expenses" ? loadMoreError : undefined}
      onLoadMore={mode === "expenses" ? handleLoadMore : undefined}
      categoryNames={categoryNames}
      paymentMethodNames={paymentMethodNames}
      categoryIcons={new Map(categories.map((item) => [item.id, item.iconKey] as const))}
      paymentMethodIcons={new Map(paymentMethods.map((item) => [item.id, item.iconKey] as const))}
      groupByDate={mode === "expenses"}
      summaryExpenses={mode === "expenses" ? orderedRecords : undefined}
      renderExpanded={usesInlineDetail ? () => renderDetailPanel() : undefined}
    />
  );

  function renderDetailPanel(dataTestId = "expense-detail-panel") {
    return current ? (
    <section className="relative">
      <ExpenseRecordForm
        expense={current}
        draft={currentDraft}
        categories={categories}
        tags={tags}
        paymentMethods={paymentMethods}
        timezone={timezone}
        mode={mode}
        queuePosition={currentIndex + 1}
        queueLength={records.length}
        pending={pending}
        errorMessage={errorMessage}
        statusMessage={statusMessage}
        dataTestId={dataTestId}
        onDraftChange={handleDraftChange}
        onCopyCaptureMessage={() => {
          preserveInlineScrollPosition();
          setDraftRecordId(current.id);
          setDraft((value) => copyCaptureMessageToDraft(value, current));
        }}
        onSelectPrevious={() => moveSelection(-1)}
        onSelectNext={() => moveSelection(1)}
        onPrimaryAction={() => void submitCurrent()}
        onSecondaryAction={mode === "inbox" ? () => void submitCurrent(true) : undefined}
        onSkip={mode === "inbox" ? () => moveSelection(1) : undefined}
      />
    </section>
  ) : (
    <section
      className="space-y-4 rounded-xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      data-testid="expense-detail-panel"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">开销详情</p>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">选中一条记录后查看详情</h2>
      </div>
      <p>选中任意一条记录后，这里会显示完整编辑表单和全部标签。</p>
    </section>
    );
  }

  const detailPanel = mode === "inbox" && !isMobile ? renderDetailPanel() : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            {mode === "inbox" ? "开销整理" : "开销总览"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {mode === "inbox" ? "Inbox" : "全部记录"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {mode === "inbox"
              ? "逐条确认捕获记录，未分类也可以先保留。"
              : "按发生日期回顾全部历史记录，选择一行后查看详情。"}
          </p>
        </div>
        <Link
          href={mode === "inbox" ? "/expenses" : "/inbox"}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-blue-600"
        >
          {mode === "inbox" ? <Receipt className="h-4 w-4" aria-hidden="true" /> : <Inbox className="h-4 w-4" aria-hidden="true" />}
          {mode === "inbox" ? "查看全部记录" : "返回 Inbox"}
        </Link>
      </header>

      {mode === "inbox" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {detailPanel}
          {list}
        </div>
      ) : (
        <div>{list}</div>
      )}
    </div>
  );
};
