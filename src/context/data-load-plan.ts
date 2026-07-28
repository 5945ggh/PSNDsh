export type DataResource =
  | "capabilities"
  | "entries"
  | "currentWeekPlan"
  | "activeFocus"
  | "focusSessions"
  | "scheduleBlocks"
  | "dashboard"
  | "weekStatistics";

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
  else if (pathname === "/plan") resources.push("currentWeekPlan");
  else if (pathname.startsWith("/entries/")) resources.push("focusSessions");
  else if (pathname === "/statistics") resources.push("weekStatistics");
  else if (pathname === "/review") resources.push("currentWeekPlan", "focusSessions", "weekStatistics");
  else if (pathname === "/settings") {
    resources.push("focusSessions", "scheduleBlocks");
  }

  return resources;
};

export const hasLoadedResources = (
  pathname: string,
  loadedResources: ReadonlySet<DataResource>
) => resourcesForPathname(pathname).every((resource) => loadedResources.has(resource));
