"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, CreditCard, Hash, LoaderCircle, Pencil, Plus, Tags, X, type LucideIcon } from "lucide-react";
import { useData, type DataSnapshot } from "@/context/MockContext";
import type { ExpenseCategory, ExpenseTag, PaymentMethod } from "@/lib/domain/types";
import { EXPENSE_ICON_OPTIONS, getExpenseIcon } from "@/components/expenses/expense-icons";

type DimensionItem = ExpenseCategory | ExpenseTag | PaymentMethod;
export type ExpenseDimensionKind = "category" | "paymentMethod" | "tag";

export const EXPENSE_DIMENSION_TABS: ReadonlyArray<{
  id: ExpenseDimensionKind;
  label: string;
  description: string;
  icon: LucideIcon;
  inputId: string;
  placeholder: string;
  emptyText: string;
  toneClassName: string;
}> = [
  {
    id: "category",
    label: "分类",
    description: "用于归类开销，方便筛选、汇总和历史回看。",
    icon: Hash,
    inputId: "expense-category-name",
    placeholder: "例如：餐饮",
    emptyText: "还没有分类。先建一个最常用的，例如餐饮或交通。",
    toneClassName: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  {
    id: "paymentMethod",
    label: "支付方式",
    description: "用于记录现金、银行卡、微信、支付宝等支付来源。",
    icon: CreditCard,
    inputId: "expense-payment-method-name",
    placeholder: "例如：微信支付",
    emptyText: "还没有支付方式。先补一个常用来源，后面记录会更顺手。",
    toneClassName: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  {
    id: "tag",
    label: "标签",
    description: "用于横向补充信息，例如工作日、报销、临时支出。",
    icon: Tags,
    inputId: "expense-tag-name",
    placeholder: "例如：报销",
    emptyText: "还没有标签。适合先从最常见的补充信息开始。",
    toneClassName: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
];

const sortByName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

const upsertById = <T extends { id: string }>(items: T[], item: T) => {
  return [...items.filter((candidate) => candidate.id !== item.id), item];
};

export const addCategory = (snapshot: DataSnapshot, category: ExpenseCategory): DataSnapshot => ({
  ...snapshot,
  expenseCategories: sortByName(upsertById(snapshot.expenseCategories, category)),
});

export const addTag = (snapshot: DataSnapshot, tag: ExpenseTag): DataSnapshot => ({
  ...snapshot,
  expenseTags: sortByName(upsertById(snapshot.expenseTags, tag)),
});

export const addPaymentMethod = (snapshot: DataSnapshot, paymentMethod: PaymentMethod): DataSnapshot => ({
  ...snapshot,
  paymentMethods: sortByName(upsertById(snapshot.paymentMethods, paymentMethod)),
});

export function ExpenseDimensionManager() {
  const { api, data, mutate, pendingMutations } = useData();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIconKey, setEditingIconKey] = useState<DimensionItem["iconKey"]>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);

  const [activeDimension, setActiveDimension] = useState<ExpenseDimensionKind>("category");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = editingName.trim();
    if (!value) return;

    setError(null);
    try {
      const update = { name: value, iconKey: editingIconKey };
      if (dialogMode === "create" && activeDimension === "category") {
        await mutate(() => api.createExpenseCategory(update), { backgroundRefresh: true, update: addCategory });
      } else if (dialogMode === "create" && activeDimension === "paymentMethod") {
        await mutate(() => api.createPaymentMethod(update), { backgroundRefresh: true, update: addPaymentMethod });
      } else if (dialogMode === "create") {
        await mutate(() => api.createExpenseTag(update), { backgroundRefresh: true, update: addTag });
      } else if (editingId && activeDimension === "category") {
        await mutate(() => api.renameExpenseCategory(editingId, update), { backgroundRefresh: true, update: addCategory });
      } else if (editingId && activeDimension === "paymentMethod") {
        await mutate(() => api.renamePaymentMethod(editingId, update), { backgroundRefresh: true, update: addPaymentMethod });
      } else {
        if (!editingId) return;
        await mutate(() => api.renameExpenseTag(editingId, update), { backgroundRefresh: true, update: addTag });
      }
      setDialogMode(null);
      setEditingId(null);
      setEditingName("");
      setEditingIconKey(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "创建失败");
    }
  };

  const isSubmitting = pendingMutations > 0;
  const activeTab = EXPENSE_DIMENSION_TABS.find((tab) => tab.id === activeDimension) ?? EXPENSE_DIMENSION_TABS[0];
  const ActiveIcon = activeTab.icon;
  const activeItems: DimensionItem[] =
    activeDimension === "category"
      ? data.expenseCategories
      : activeDimension === "paymentMethod"
        ? data.paymentMethods
        : data.expenseTags;
  const activeToneClassName = activeTab.toneClassName;
  const openCreateDialog = () => {
    setEditingId(null);
    setEditingName("");
    setEditingIconKey(null);
    setError(null);
    setDialogMode("create");
  };
  const activateDimension = (dimension: ExpenseDimensionKind) => {
    setActiveDimension(dimension);
    window.requestAnimationFrame(() => {
      document.getElementById(`expense-dimension-tab-${dimension}`)?.focus();
    });
  };
  const selectAdjacentDimension = (direction: 1 | -1) => {
    const activeIndex = EXPENSE_DIMENSION_TABS.findIndex((tab) => tab.id === activeDimension);
    const nextIndex = (activeIndex + direction + EXPENSE_DIMENSION_TABS.length) % EXPENSE_DIMENSION_TABS.length;
    activateDimension(EXPENSE_DIMENSION_TABS[nextIndex].id);
  };

  const beginEdit = (item: DimensionItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingIconKey(item.iconKey ?? null);
    setError(null);
    setDialogMode("edit");
  };

  useEffect(() => {
    if (!dialogMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) setDialogMode(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogMode, isSubmitting]);

  return (
    <section aria-label="账目字段" className="space-y-4">
      <div role="tablist" aria-label="账目字段类型" className="flex w-full border-b border-zinc-200 dark:border-zinc-800">
        {EXPENSE_DIMENSION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeDimension;

          return (
            <button
              key={tab.id}
              id={`expense-dimension-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`expense-dimension-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => activateDimension(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  selectAdjacentDimension(1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  selectAdjacentDimension(-1);
                } else if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  activateDimension(event.key === "Home" ? EXPENSE_DIMENSION_TABS[0].id : EXPENSE_DIMENSION_TABS[EXPENSE_DIMENSION_TABS.length - 1].id);
                }
              }}
              className={`relative inline-flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 sm:flex-none sm:justify-start sm:px-4 ${
                isActive
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-zinc-900 dark:bg-zinc-100" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div
        id={`expense-dimension-panel-${activeDimension}`}
        role="tabpanel"
        aria-labelledby={`expense-dimension-tab-${activeDimension}`}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70"
      >
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div className="flex min-w-0 items-start gap-2.5">
            <ActiveIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{activeTab.description}</p>
          </div>
          <span className={`shrink-0 self-start rounded-full px-2 py-1 text-[11px] font-medium sm:self-auto ${activeToneClassName}`}>
            {activeItems.length} 项
          </span>
        </div>

        <div className="space-y-5 px-5 py-5">
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button type="button" onClick={openCreateDialog} disabled={isSubmitting} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white ${activeToneClassName.includes("emerald") ? "bg-emerald-700 hover:bg-emerald-800" : activeToneClassName.includes("blue") ? "bg-blue-700 hover:bg-blue-800" : "bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-200 dark:text-zinc-900"}`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          新建{activeTab.label}
        </button>

          <div>
            <div className="mb-2">
              <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-500">已有项目</h3>
            </div>
            <ul aria-label={`${activeTab.label}列表`} className="space-y-2">
              {activeItems.length === 0 ? (
                <li className="list-none rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                  {activeTab.emptyText}
                </li>
              ) : (
                activeItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40"
                  >
                  <>
                      <div className="flex min-w-0 items-center gap-2">
                        {(() => { const Icon = getExpenseIcon(item.iconKey, activeDimension === "paymentMethod" ? "wallet" : activeDimension === "tag" ? "tag" : "circle-help"); return <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />; })()}
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
                        {item.archivedAt && <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-500">已归档</span>}
                      </div>
                      <div className="flex items-center gap-2"><button type="button" aria-label={`编辑${item.name}`} onClick={() => beginEdit(item)} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${activeToneClassName}`}>可选</span></div>
                    </>
                  </li>
                ))
              )}
            </ul>
          </div>

        {isSubmitting && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            保存中...
          </div>
        )}
      </div>
      </div>
      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setDialogMode(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="expense-dimension-dialog-title" className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="expense-dimension-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{dialogMode === "create" ? `新建${activeTab.label}` : `编辑${activeTab.label}`}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">设置名称和用于识别的图标。</p>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setDialogMode(null)} disabled={isSubmitting} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <label htmlFor="expense-dimension-dialog-name" className="block text-sm text-zinc-700 dark:text-zinc-300">名称<input id="expense-dimension-dialog-name" autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={80} placeholder={activeTab.placeholder} className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" /></label>
              <div>
                <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300">图标</p>
                <div className="grid grid-cols-6 gap-2" aria-label="选择图标">
                  <button type="button" aria-label="不使用图标" onClick={() => setEditingIconKey(null)} className={`rounded-md border px-2 py-2 text-xs ${editingIconKey === null ? "border-blue-500 bg-blue-50" : "border-zinc-200 dark:border-zinc-700"}`}>无</button>
                  {EXPENSE_ICON_OPTIONS.map(({ key, label }) => { const Icon = getExpenseIcon(key); return <button key={key} type="button" aria-label={label} title={label} onClick={() => setEditingIconKey(key)} className={`flex items-center justify-center rounded-md border p-2 ${editingIconKey === key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-500 dark:border-zinc-700"}`}><Icon className="h-4 w-4" aria-hidden="true" /></button>; })}
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDialogMode(null)} disabled={isSubmitting} className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">取消</button>
                <button type="submit" disabled={!editingName.trim() || isSubmitting} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"><Check className="h-4 w-4" aria-hidden="true" />{isSubmitting ? "保存中" : dialogMode === "create" ? "创建" : "保存"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
