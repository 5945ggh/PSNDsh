"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { ApiAdapter, ApiClientError, isUnauthorizedError } from "@/lib/api/client";
import { sortExpensesForHistory } from "@/lib/expenses/history";
import {
  createApiAdapter,
  DataTransport,
  getDataTransport,
  isMockApiFeatures,
} from "@/lib/api/adapter";
import {
  AuthSession,
  Capabilities,
  DashboardPayload,
  Entry,
  Expense,
  ExpenseCategory,
  ExpenseTag,
  FocusSession,
  PaymentMethod,
  ScheduleBlock,
  StatisticsPayload,
  WeekPlan,
} from "@/lib/domain/types";
import type { ScenarioPreset } from "@/lib/mock/types";
import {
  type DataResource,
  hasLoadedResources,
  resourcesForPathname,
  resourcesForViewer,
} from "@/context/data-load-plan";

export type DataLoadStatus = "loading" | "ready" | "error";

export type DataSnapshot = {
  capabilities: Capabilities | null;
  session: AuthSession;
  entries: Entry[];
  currentWeekPlan: WeekPlan | null;
  activeFocus: FocusSession | null;
  focusSessions: FocusSession[];
  scheduleBlocks: ScheduleBlock[];
  dashboard: DashboardPayload | null;
  statistics: Partial<Record<"day" | "week" | "month", StatisticsPayload>>;
  expenses: Expense[];
  expensesNextCursor: string | null;
  expensesHasMore: boolean;
  inboxExpenses: Expense[];
  expenseCategories: ExpenseCategory[];
  expenseTags: ExpenseTag[];
  paymentMethods: PaymentMethod[];
};

export type RefreshOptions = {
  /** Keeps the rendered workspace stable while authoritative data is reloaded. */
  background?: boolean;
};

export type MutationOptions<T> = {
  refresh?: boolean;
  /** Do not wait for the post-write revalidation before returning to the caller. */
  backgroundRefresh?: boolean;
  /** Applies a server-confirmed result immediately, before any revalidation completes. */
  update?: (snapshot: DataSnapshot, result: T) => DataSnapshot;
};

export type DataContextType = {
  transport: DataTransport;
  isMockTransport: boolean;
  api: ApiAdapter;
  data: DataSnapshot;
  status: DataLoadStatus;
  error: Error | null;
  pendingMutations: number;
  version: number;
  refresh: (options?: RefreshOptions) => Promise<void>;
  loadMoreExpenses: () => Promise<void>;
  mutate: <T>(
    operation: () => Promise<T>,
    options?: MutationOptions<T>
  ) => Promise<T>;
  clearError: () => void;
  scenario: ScenarioPreset;
  setScenario: (preset: ScenarioPreset) => void;
};

type LoadedResources = {
  userId: string | null;
  resources: Set<DataResource>;
};

const emptyData = (): DataSnapshot => ({
  capabilities: null,
  session: { user: null },
  entries: [],
  currentWeekPlan: null,
  activeFocus: null,
  focusSessions: [],
  scheduleBlocks: [],
  dashboard: null,
  statistics: {},
  expenses: [],
  expensesNextCursor: null,
  expensesHasMore: false,
  inboxExpenses: [],
  expenseCategories: [],
  expenseTags: [],
  paymentMethods: [],
});

const DataContext = createContext<DataContextType | null>(null);

const readAuthenticatedData = async (
  api: ApiAdapter,
  session: AuthSession,
  pathname: string,
  current: DataSnapshot
) => {
  if (!session.user) return emptyData();

  const resources = new Set(resourcesForPathname(pathname));
  const sameUser = current.session.user?.id === session.user.id;
  const previous = sameUser ? current : emptyData();
  const [
    capabilities,
    entries,
    currentWeekPlan,
    activeFocus,
    focusSessions,
    scheduleBlocks,
    dashboard,
    weekStatistics,
    expenseHistoryPage,
    inboxExpenses,
    expenseCategories,
    expenseTags,
    paymentMethods,
  ] = await Promise.all([
    resources.has("capabilities") ? api.getCapabilities() : previous.capabilities,
    resources.has("entries") ? api.getEntries() : previous.entries,
    resources.has("currentWeekPlan") ? api.getWeekPlan() : previous.currentWeekPlan,
    resources.has("activeFocus") ? api.getActiveFocus() : previous.activeFocus,
    resources.has("focusSessions") ? api.getFocusSessions() : previous.focusSessions,
    resources.has("scheduleBlocks") ? api.getScheduleBlocks() : previous.scheduleBlocks,
    resources.has("dashboard") ? api.getDashboardPayload() : previous.dashboard,
    resources.has("weekStatistics")
      ? api.getStatisticsPayload("week")
      : previous.statistics.week,
    resources.has("expenses") ? api.getExpenseHistoryPage(25) : null,
    resources.has("inboxExpenses") ? api.getInboxExpenses() : previous.inboxExpenses,
    resources.has("expenseDimensions") ? api.getExpenseCategories() : previous.expenseCategories,
    resources.has("expenseDimensions") ? api.getExpenseTags() : previous.expenseTags,
    resources.has("expenseDimensions") ? api.getPaymentMethods() : previous.paymentMethods,
  ]);

  // A first-page response represents one exact server snapshot. Replacing the
  // previously loaded tail prevents a refreshed cursor from bridging revisions.
  const expenses = expenseHistoryPage ? expenseHistoryPage.items : previous.expenses;
  const expensesNextCursor = expenseHistoryPage
    ? expenseHistoryPage.nextCursor
    : previous.expensesNextCursor;
  const expensesHasMore = expenseHistoryPage
    ? expenseHistoryPage.hasMore
    : previous.expensesHasMore;

  return {
    capabilities,
    session,
    entries,
    currentWeekPlan,
    activeFocus,
    focusSessions,
    scheduleBlocks,
    dashboard,
    statistics: weekStatistics
      ? { ...previous.statistics, week: weekStatistics }
      : previous.statistics,
    expenses,
    expensesNextCursor,
    expensesHasMore,
    inboxExpenses,
    expenseCategories,
    expenseTags,
    paymentMethods,
  } satisfies DataSnapshot;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const transport = getDataTransport();
  const api = useMemo(() => createApiAdapter(transport), [transport]);
  const [data, setData] = useState<DataSnapshot>(emptyData);
  const [status, setStatus] = useState<DataLoadStatus>("loading");
  const [error, setError] = useState<Error | null>(null);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [version, setVersion] = useState(0);
  const [loadedResources, setLoadedResources] = useState<LoadedResources>({
    userId: null,
    resources: new Set(),
  });
  const [scenario, setScenarioState] = useState<ScenarioPreset>(() =>
    isMockApiFeatures(api) ? api.getScenario() : "normal"
  );
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);
  const snapshotRef = useRef<DataSnapshot>(emptyData());
  const loadedResourcesRef = useRef<LoadedResources>({
    userId: null,
    resources: new Set(),
  });
  const loadingExpensesRef = useRef(false);

  const refresh = useCallback(async ({ background = false }: RefreshOptions = {}) => {
    const requestId = ++requestVersion.current;
    const refreshMutationVersion = mutationVersion.current;
    if (!background) {
      setStatus("loading");
      setError(null);
    }

    try {
      let session: AuthSession;
      try {
        session = await api.getSession();
      } catch (requestError) {
        if (!isUnauthorizedError(requestError)) throw requestError;
        session = { user: null };
      }

      const next = session.user
        ? await readAuthenticatedData(api, session, pathname, snapshotRef.current)
        : { ...emptyData(), capabilities: await api.getCapabilities() };

      if (requestId !== requestVersion.current || refreshMutationVersion !== mutationVersion.current) return;
      const userId = session.user?.id ?? null;
      const loadedResources =
        loadedResourcesRef.current.userId === userId
          ? new Set(loadedResourcesRef.current.resources)
          : new Set<DataResource>();
      const fetchedResources = resourcesForViewer(pathname, Boolean(session.user));
      fetchedResources.forEach((resource) => loadedResources.add(resource));
      const nextLoadedResources = { userId, resources: loadedResources };
      loadedResourcesRef.current = nextLoadedResources;
      setLoadedResources(nextLoadedResources);
      snapshotRef.current = next;
      setData(next);
      setStatus("ready");
      setVersion((current) => current + 1);
    } catch (requestError) {
      if (requestId !== requestVersion.current) return;
      const nextError =
        requestError instanceof Error ? requestError : new Error("数据加载失败");
      setError(nextError);
      if (!background) setStatus("error");
    }
  }, [api, pathname]);

  const loadMoreExpenses = useCallback(async () => {
    if (loadingExpensesRef.current || !snapshotRef.current.expensesHasMore) return;
    const cursor = snapshotRef.current.expensesNextCursor;
    if (!cursor) return;
    const requestId = requestVersion.current;
    const userId = snapshotRef.current.session.user?.id ?? null;
    loadingExpensesRef.current = true;
    try {
      const page = await api.getExpenseHistoryPage(25, cursor);
      if (
        requestVersion.current !== requestId ||
        snapshotRef.current.session.user?.id !== userId ||
        snapshotRef.current.expensesNextCursor !== cursor
      ) return;
      setData((current) => {
        const timezone = current.capabilities?.effectiveTimezone ?? "Asia/Shanghai";
        const expenses = sortExpensesForHistory(
          Array.from(
            new Map([...current.expenses, ...page.items].map((expense) => [expense.id, expense] as const)).values(),
          ),
          timezone,
        );
        const next = {
          ...current,
          expenses,
          expensesNextCursor: page.nextCursor,
          expensesHasMore: page.hasMore,
        };
        snapshotRef.current = next;
        return next;
      });
      setVersion((current) => current + 1);
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.code === "EXPENSE_HISTORY_STALE") {
        await refresh();
        return;
      }
      throw requestError;
    } finally {
      loadingExpensesRef.current = false;
    }
  }, [api, refresh]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      const currentUserId = snapshotRef.current.session.user?.id ?? null;
      const routeDataReady =
        loadedResourcesRef.current.userId === currentUserId &&
        hasLoadedResources(
          pathname,
          loadedResourcesRef.current.resources,
          Boolean(snapshotRef.current.session.user)
        );
      void refresh({
        background: requestVersion.current > 0 && routeDataReady,
      });
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [pathname, refresh]);

  useEffect(() => {
    if (!isMockApiFeatures(api)) return;
    return api.subscribe(() => {
      setScenarioState(api.getScenario());
      void refresh();
    });
  }, [api, refresh]);

  const mutate = useCallback(
    async <T,>(operation: () => Promise<T>, options: MutationOptions<T> = {}) => {
      setPendingMutations((current) => current + 1);
      setError(null);
      mutationVersion.current += 1;
      try {
        const result = await operation();
        const applyUpdate = () => {
          if (!options.update) return;
          setData((current) => {
            const next = options.update?.(current, result) ?? current;
            snapshotRef.current = next;
            return next;
          });
        };
        applyUpdate();
        if (options.refresh !== false) {
          const revalidation = refresh({ background: true });
          if (options.backgroundRefresh) {
            void revalidation.then(applyUpdate);
          } else {
            await revalidation;
            // Reapply the server-confirmed mutation after revalidation so an
            // overlapping/stale response cannot resurrect the edited record.
            applyUpdate();
          }
        }
        return result;
      } catch (mutationError) {
        const nextError =
          mutationError instanceof Error
            ? mutationError
            : new Error("保存数据时发生未知错误");
        setError(nextError);
        throw nextError;
      } finally {
        setPendingMutations((current) => Math.max(0, current - 1));
      }
    },
    [refresh]
  );

  const setScenario = useCallback(
    (preset: ScenarioPreset) => {
      if (!isMockApiFeatures(api)) return;
      api.setScenario(preset);
    },
    [api]
  );

  const currentUserId = data.session.user?.id ?? null;
  const routeDataReady =
    loadedResources.userId === currentUserId &&
    hasLoadedResources(pathname, loadedResources.resources, Boolean(data.session.user));
  const visibleStatus = status === "ready" && !routeDataReady ? "loading" : status;

  const value = useMemo<DataContextType>(
    () => ({
      transport,
      isMockTransport: transport === "mock",
      api,
      data,
      status: visibleStatus,
      error,
      pendingMutations,
      version,
      refresh,
      mutate,
      loadMoreExpenses,
      clearError: () => setError(null),
      scenario,
      setScenario,
    }),
    [
      api,
      data,
      error,
      mutate,
      loadMoreExpenses,
      pendingMutations,
      refresh,
      scenario,
      setScenario,
      transport,
      version,
      visibleStatus,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};

// These aliases keep existing imports working while pages migrate to useData.
export const MockProvider = DataProvider;
export const useMock = useData;
