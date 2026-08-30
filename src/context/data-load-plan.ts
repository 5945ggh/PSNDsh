export type DataResource =
  | "capabilities"
  | "entries"
  | "currentWeekPlan"
  | "activeFocus"
  | "focusSessions"
  | "scheduleBlocks"
  | "dashboard"
  | "weekStatistics"
  | "expenses"
  | "inboxExpenses"
  | "expenseDimensions";

const WORKSPACE_BASE: DataResource[] = [
  "capabilities",
  "entries",
  "activeFocus",
];

export const resourcesForPathname = (pathname: string): DataResource[] => {
  if (pathname === "/login" || pathname === "/register") {
    return ["capabilities"];
  }

  const resources = [...WORKSPACE_BASE];

  if (pathname === "/") resources.push("dashboard");
  else if (pathname === "/plan") resources.push("currentWeekPlan", "weekStatistics");
  else if (pathname.startsWith("/entries/")) resources.push("focusSessions");
  else if (pathname === "/statistics") resources.push("weekStatistics");
  else if (pathname === "/review") resources.push("currentWeekPlan", "weekStatistics");
  else if (pathname === "/inbox") resources.push("inboxExpenses", "expenseDimensions");
  else if (pathname === "/expenses") resources.push("expenses", "expenseDimensions");
  else if (pathname === "/settings") {
    resources.push("focusSessions", "scheduleBlocks", "expenseDimensions");
  }

  return resources;
};

export const resourcesForViewer = (
  pathname: string,
  isAuthenticated: boolean
): DataResource[] =>
  isAuthenticated ? resourcesForPathname(pathname) : ["capabilities"];

export const hasLoadedResources = (
  pathname: string,
  loadedResources: ReadonlySet<DataResource>,
  isAuthenticated: boolean
) =>
  resourcesForViewer(pathname, isAuthenticated).every((resource) =>
    loadedResources.has(resource)
  );
