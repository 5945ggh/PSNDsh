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
import { ApiAdapter, isUnauthorizedError } from "@/lib/api/client";
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
  FocusSession,
  ScheduleBlock,
  ScenarioPreset,
  StatisticsPayload,
  WeekPlan,
} from "@/types/mock";

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
  mutate: <T>(
    operation: () => Promise<T>,
    options?: MutationOptions<T>
  ) => Promise<T>;
  clearError: () => void;
  scenario: ScenarioPreset;
  setScenario: (preset: ScenarioPreset) => void;
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
});

const DataContext = createContext<DataContextType | null>(null);

const readAuthenticatedData = async (api: ApiAdapter, session: AuthSession) => {
  if (!session.user) return emptyData();

  const [
    capabilities,
    entries,
    currentWeekPlan,
    activeFocus,
    focusSessions,
    scheduleBlocks,
    dashboard,
    weekStatistics,
  ] = await Promise.all([
    api.getCapabilities(),
    api.getEntries(),
    api.getWeekPlan(),
    api.getActiveFocus(),
    api.getFocusSessions(),
    api.getScheduleBlocks(),
    api.getDashboardPayload(),
    api.getStatisticsPayload("week"),
  ]);

  return {
    capabilities,
    session,
    entries,
    currentWeekPlan,
    activeFocus,
    focusSessions,
    scheduleBlocks,
    dashboard,
    statistics: { week: weekStatistics },
  } satisfies DataSnapshot;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const transport = getDataTransport();
  const api = useMemo(() => createApiAdapter(transport), [transport]);
  const [data, setData] = useState<DataSnapshot>(emptyData);
  const [status, setStatus] = useState<DataLoadStatus>("loading");
  const [error, setError] = useState<Error | null>(null);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [version, setVersion] = useState(0);
  const [scenario, setScenarioState] = useState<ScenarioPreset>(() =>
    isMockApiFeatures(api) ? api.getScenario() : "normal"
  );
  const requestVersion = useRef(0);

  const refresh = useCallback(async ({ background = false }: RefreshOptions = {}) => {
    const requestId = ++requestVersion.current;
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
        ? await readAuthenticatedData(api, session)
        : { ...emptyData(), capabilities: await api.getCapabilities() };

      if (requestId !== requestVersion.current) return;
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
  }, [api]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [refresh]);

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
      try {
        const result = await operation();
        if (options.update) {
          setData((current) => options.update?.(current, result) ?? current);
        }
        if (options.refresh !== false) {
          const revalidation = refresh({ background: true });
          if (options.backgroundRefresh) {
            void revalidation;
          } else {
            await revalidation;
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

  const value = useMemo<DataContextType>(
    () => ({
      transport,
      isMockTransport: transport === "mock",
      api,
      data,
      status,
      error,
      pendingMutations,
      version,
      refresh,
      mutate,
      clearError: () => setError(null),
      scenario,
      setScenario,
    }),
    [
      api,
      data,
      error,
      mutate,
      pendingMutations,
      refresh,
      scenario,
      setScenario,
      status,
      transport,
      version,
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
