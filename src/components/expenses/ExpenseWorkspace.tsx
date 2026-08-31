"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Inbox, Receipt, SlidersHorizontal, X } from "lucide-react";
import { useData, type DataSnapshot } from "@/context/MockContext";
import type { Expense } from "@/lib/domain/types";
import { formatDateKeyInTimezone } from "@/lib/time/timezone";
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
type ExpenseDatePreset = "all" | "today" | "last7" | "month" | "custom";
type ExpenseFilterDraft = {
  q: string;
  from: string;
  to: string;
  categoryId: string;
  paymentMethodId: string;
  tagId: string;
  reviewStatus: "" | "pending" | "reviewed";
  datePreset: ExpenseDatePreset;
};

const emptyExpenseFilterDraft = (): ExpenseFilterDraft => ({
  q: "",
  from: "",
  to: "",
  categoryId: "",
  paymentMethodId: "",
  tagId: "",
  reviewStatus: "",
  datePreset: "all",
});

const shiftExpenseDateKey = (dateKey: string, days: number) => {
  const value = new Date(`${dateKey}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const getExpenseDateRangeForPreset = (
  preset: Exclude<ExpenseDatePreset, "all" | "custom">,
  timezone: string,
  now = new Date(),
) => {
  const to = formatDateKeyInTimezone(now, timezone);
  if (preset === "today") return { from: to, to };
  if (preset === "last7") {
    return { from: shiftExpenseDateKey(to, -6), to };
  }
  return { from: `${to.slice(0, 7)}-01`, to };
};

export const inferExpenseDatePreset = (
  from: string,
  to: string,
  timezone: string,
  now = new Date(),
): ExpenseDatePreset => {
  if (!from && !to) return "all";
  const presets: Array<Exclude<ExpenseDatePreset, "all" | "custom">> = ["today", "last7", "month"];
  return presets.find((preset) => {
    const range = getExpenseDateRangeForPreset(preset, timezone, now);
    return range.from === from && range.to === to;
  }) ?? "custom";
};

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

export const removeExpenseFromSnapshot = (snapshot: DataSnapshot, expenseId: string): DataSnapshot => ({
  ...snapshot,
  expenses: snapshot.expenses.filter((item) => item.id !== expenseId),
  inboxExpenses: snapshot.inboxExpenses.filter((item) => item.id !== expenseId),
});

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
  const [searchQuery, setSearchQuery] = useState<ExpenseFilterDraft>(emptyExpenseFilterDraft);
  const [mobileFilterDraft, setMobileFilterDraft] = useState<ExpenseFilterDraft>(emptyExpenseFilterDraft);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [filteredRecords, setFilteredRecords] = useState<Expense[] | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterRetryNonce, setFilterRetryNonce] = useState(0);
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

  const displayedRecords = mode === "expenses" && filteredRecords !== null ? filteredRecords : records;
  const pageCount = getExpensePageCount(displayedRecords.length);
  const visiblePageIndex = Math.min(pageIndex, pageCount - 1);
  const orderedRecords = useMemo(
    () => (mode === "expenses" ? sortExpensesForHistory(displayedRecords, timezone) : displayedRecords),
    [displayedRecords, mode, timezone],
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
  const hasActiveFilters = Boolean(
    searchQuery.q || searchQuery.from || searchQuery.to || searchQuery.categoryId ||
    searchQuery.paymentMethodId || searchQuery.tagId || searchQuery.reviewStatus,
  );
  const activeFilterLabels = [
    searchQuery.q ? `关键词：${searchQuery.q}` : null,
    searchQuery.from || searchQuery.to ? `日期：${searchQuery.from || "不限"} 至 ${searchQuery.to || "不限"}` : null,
    searchQuery.categoryId ? `分类：${categoryNames.get(searchQuery.categoryId) ?? "已选"}` : null,
    searchQuery.paymentMethodId ? `支付方式：${paymentMethodNames.get(searchQuery.paymentMethodId) ?? "已选"}` : null,
    searchQuery.tagId ? `标签：${tags.find((item) => item.id === searchQuery.tagId)?.name ?? "已选"}` : null,
    searchQuery.reviewStatus ? `状态：${searchQuery.reviewStatus === "pending" ? "待整理" : "已整理"}` : null,
  ].filter((label): label is string => Boolean(label));

  useEffect(() => {
    if (mode !== "expenses") return;
    const query = {
      q: searchQuery.q || undefined,
      from: searchQuery.from || undefined,
      to: searchQuery.to || undefined,
      categoryId: searchQuery.categoryId || undefined,
      paymentMethodId: searchQuery.paymentMethodId || undefined,
      tagId: searchQuery.tagId || undefined,
      reviewStatus: searchQuery.reviewStatus || undefined,
    };
    if (!Object.values(query).some(Boolean)) {
      const reset = window.setTimeout(() => {
        setFilteredRecords(null);
        setFilterError(null);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    let cancelled = false;
    const loadAllFilteredRecords = async () => {
      const items: Expense[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.getExpenseHistoryPage(100, cursor, query);
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
        if (!page.hasMore) break;
      } while (!cancelled);
      if (!cancelled) {
        setFilteredRecords(items);
        setFilterError(null);
      }
    };
    void loadAllFilteredRecords().catch(() => {
      if (!cancelled) setFilterError("筛选结果加载失败，请重试。");
    });
    return () => { cancelled = true; };
  }, [api, data.expenses, filterRetryNonce, mode, searchQuery]);

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

  const deleteCurrent = useCallback(async () => {
    if (!current || submitInFlightRef.current) return;
    if (!window.confirm("确定删除这条开销记录吗？删除后将从记录和 Inbox 中移除。")) return;
    submitInFlightRef.current = true;
    preserveInlineScrollPosition();
    setIsSubmitting(true);
    setErrorMessage(null);
    const currentIndexBeforeDelete = orderedRecords.findIndex((item) => item.id === current.id);
    const nextRecord = orderedRecords[currentIndexBeforeDelete + 1] ?? orderedRecords[currentIndexBeforeDelete - 1] ?? null;
    try {
      await mutate(() => api.deleteExpense(current.id), {
        refresh: false,
        update: (snapshot) => removeExpenseFromSnapshot(snapshot, current.id),
      });
      setSelectedId(nextRecord?.id ?? null);
      setDraftRecordId(nextRecord?.id ?? null);
      setDraft(seedExpenseDraft(nextRecord));
      if (nextRecord) {
        const nextIndex = orderedRecords.findIndex((item) => item.id === nextRecord.id);
        setPageIndex(getExpensePageIndex(Math.max(0, nextIndex)));
      }
      setStatusMessage("已删除开销记录。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      preserveInlineScrollPosition();
      setIsSubmitting(false);
      submitInFlightRef.current = false;
    }
  }, [api, current, mutate, orderedRecords, preserveInlineScrollPosition]);

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
      totalCount={displayedRecords.length}
      totalCountLabel={mode === "expenses" ? (filteredRecords ? `筛选结果 ${displayedRecords.length} 条` : `已加载 ${displayedRecords.length} 条`) : undefined}
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
        onDelete={() => void deleteCurrent()}
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
        <div className="space-y-4">
          <div className="hidden gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid lg:grid-cols-6">
            <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 lg:col-span-2">关键词（备注/捕获消息）<input aria-label="搜索备注或捕获消息" value={searchQuery.q} onChange={(event) => setSearchQuery((value) => ({ ...value, q: event.target.value }))} placeholder="输入关键词" className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:text-zinc-100" /></label>
            <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">发生日期（起）<input aria-label="开始日期" type="date" value={searchQuery.from} onChange={(event) => setSearchQuery((value) => ({ ...value, from: event.target.value }))} className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:text-zinc-100" /></label>
            <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">发生日期（止）<input aria-label="结束日期" type="date" value={searchQuery.to} onChange={(event) => setSearchQuery((value) => ({ ...value, to: event.target.value }))} className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:text-zinc-100" /></label>
            <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">分类<select aria-label="分类筛选" value={searchQuery.categoryId} onChange={(event) => setSearchQuery((value) => ({ ...value, categoryId: event.target.value }))} className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"><option value="">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">支付方式<select aria-label="支付方式筛选" value={searchQuery.paymentMethodId} onChange={(event) => setSearchQuery((value) => ({ ...value, paymentMethodId: event.target.value }))} className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"><option value="">全部支付方式</option>{paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">标签<select aria-label="标签筛选" value={searchQuery.tagId} onChange={(event) => setSearchQuery((value) => ({ ...value, tagId: event.target.value }))} className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"><option value="">全部标签</option>{tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">整理状态<select aria-label="整理状态筛选" value={searchQuery.reviewStatus} onChange={(event) => setSearchQuery((value) => ({ ...value, reviewStatus: event.target.value as "" | "pending" | "reviewed" }))} className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"><option value="">全部状态</option><option value="pending">待整理</option><option value="reviewed">已整理</option></select></label>
          </div>
          <div className="space-y-3 lg:hidden">
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">搜索备注或捕获消息</span>
                <input
                  aria-label="搜索备注或捕获消息"
                  value={searchQuery.q}
                  onChange={(event) => setSearchQuery((value) => ({ ...value, q: event.target.value }))}
                  placeholder="搜索备注或捕获消息"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setMobileFilterDraft({ ...searchQuery, datePreset: inferExpenseDatePreset(searchQuery.from, searchQuery.to, timezone) });
                  setMobileFilterOpen(true);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span>筛选</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{searchQuery.from || searchQuery.to ? `${searchQuery.from || "不限"} 至 ${searchQuery.to || "不限"}` : "全部时间"}</span>
              {activeFilterLabels.filter((label) => !label.startsWith("日期：")).map((label) => <span key={label} className="max-w-full truncate rounded-full bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{label}</span>)}
              {!hasActiveFilters && <span className="text-zinc-400">未启用其他筛选</span>}
            </div>
          </div>
          {mobileFilterOpen && (
            <div className="fixed inset-0 z-50 flex items-end bg-black/30 lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileFilterOpen(false); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="mobile-expense-filter-title" className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-950">
                <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                  <div>
                    <h2 id="mobile-expense-filter-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">筛选全部记录</h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">选择条件后应用到记录列表</p>
                  </div>
                  <button type="button" onClick={() => setMobileFilterOpen(false)} aria-label="关闭筛选面板" title="关闭筛选面板" className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" aria-hidden="true" /></button>
                </header>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                  <label className="block space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">关键词（备注/捕获消息）<input value={mobileFilterDraft.q} onChange={(event) => setMobileFilterDraft((value) => ({ ...value, q: event.target.value }))} placeholder="输入关键词" className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2.5 text-sm font-normal dark:border-zinc-700 dark:text-zinc-100" /></label>
                  <fieldset className="space-y-2"><legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">发生日期</legend><div className="grid grid-cols-2 gap-2">{([['all', '全部时间'], ['today', '今天'], ['last7', '最近 7 天'], ['month', '本月'], ['custom', '自定义范围']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { const range = value === 'all' ? { from: '', to: '' } : value === 'custom' ? { from: mobileFilterDraft.from, to: mobileFilterDraft.to } : getExpenseDateRangeForPreset(value, timezone); setMobileFilterDraft((draft) => ({ ...draft, datePreset: value, ...range })); }} className={`rounded-md border px-3 py-2.5 text-sm ${mobileFilterDraft.datePreset === value ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200'}`}>{label}</button>)}</div>{mobileFilterDraft.datePreset === 'custom' && <div className="grid grid-cols-2 gap-3 pt-1"><label className="space-y-1 text-xs text-zinc-500">开始日期<input type="date" value={mobileFilterDraft.from} onChange={(event) => setMobileFilterDraft((draft) => ({ ...draft, from: event.target.value }))} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-sm dark:border-zinc-700" /></label><label className="space-y-1 text-xs text-zinc-500">结束日期<input type="date" value={mobileFilterDraft.to} onChange={(event) => setMobileFilterDraft((draft) => ({ ...draft, to: event.target.value }))} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-sm dark:border-zinc-700" /></label></div>}</fieldset>
                  <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">分类<select value={mobileFilterDraft.categoryId} onChange={(event) => setMobileFilterDraft((value) => ({ ...value, categoryId: event.target.value }))} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2.5 text-sm font-normal dark:border-zinc-700 dark:text-zinc-100"><option value="">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">支付方式<select value={mobileFilterDraft.paymentMethodId} onChange={(event) => setMobileFilterDraft((value) => ({ ...value, paymentMethodId: event.target.value }))} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2.5 text-sm font-normal dark:border-zinc-700 dark:text-zinc-100"><option value="">全部支付方式</option>{paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">标签<select value={mobileFilterDraft.tagId} onChange={(event) => setMobileFilterDraft((value) => ({ ...value, tagId: event.target.value }))} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2.5 text-sm font-normal dark:border-zinc-700 dark:text-zinc-100"><option value="">全部标签</option>{tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">整理状态<select value={mobileFilterDraft.reviewStatus} onChange={(event) => setMobileFilterDraft((value) => ({ ...value, reviewStatus: event.target.value as "" | "pending" | "reviewed" }))} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2.5 text-sm font-normal dark:border-zinc-700 dark:text-zinc-100"><option value="">全部状态</option><option value="pending">待整理</option><option value="reviewed">已整理</option></select></label></div>
                </div>
                <footer className="flex gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800"><button type="button" onClick={() => setMobileFilterDraft(emptyExpenseFilterDraft())} className="flex-1 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">重置</button><button type="button" onClick={() => { setSearchQuery(mobileFilterDraft); setMobileFilterOpen(false); }} className="flex-1 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">应用筛选</button></footer>
              </section>
            </div>
          )}
          {filterError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              <span>{filterError}</span>
              <button type="button" onClick={() => setFilterRetryNonce((value) => value + 1)} className="shrink-0 rounded-md border border-current px-2.5 py-1 text-xs font-medium">重试</button>
            </div>
          )}
          {list}
        </div>
      )}
    </div>
  );
};
