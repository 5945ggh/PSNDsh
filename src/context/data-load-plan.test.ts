import { describe, expect, it } from "vitest";
import {
  hasLoadedResources,
  resourcesForPathname,
  resourcesForViewer,
} from "./data-load-plan";

describe("resourcesForPathname", () => {
  it("keeps authentication routes free of user-owned datasets", () => {
    expect(resourcesForPathname("/login")).toEqual(["capabilities"]);
    expect(resourcesForPathname("/register")).toEqual(["capabilities"]);
  });

  it("loads only the dashboard summary on the home route", () => {
    expect(resourcesForPathname("/")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "dashboard",
    ]);
  });

  it("loads the week plan and current-week statistics for the plan route", () => {
    expect(resourcesForPathname("/plan")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "currentWeekPlan",
      "weekStatistics",
    ]);
  });

  it("uses the calendar range endpoint instead of global history lists", () => {
    const resources = resourcesForPathname("/calendar");

    expect(resources).toEqual(["capabilities", "entries", "activeFocus"]);
    expect(resources).not.toContain("focusSessions");
    expect(resources).not.toContain("scheduleBlocks");
  });

  it("loads focus history for entry details and summary counts for settings", () => {
    expect(resourcesForPathname("/entries/entry-1")).toContain("focusSessions");
    expect(resourcesForPathname("/settings")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "focusSessions",
      "scheduleBlocks",
      "expenseDimensions",
    ]);
  });

  it("preloads only the default week statistics on the statistics route", () => {
    expect(resourcesForPathname("/statistics")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "weekStatistics",
    ]);
  });

  it("loads the review route without redundant focus history", () => {
    expect(resourcesForPathname("/review")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "currentWeekPlan",
      "weekStatistics",
    ]);
  });

  it("loads inbox and expense routes with their dedicated expense resources", () => {
    expect(resourcesForPathname("/inbox")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "inboxExpenses",
      "expenseDimensions",
    ]);
    expect(resourcesForPathname("/expenses")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "expenses",
      "expenseDimensions",
    ]);
  });

  it("loads Inbox records on demand without loading the complete expense history", () => {
    const resources = resourcesForPathname("/inbox");
    expect(resources).toContain("inboxExpenses");
    expect(resources).toContain("expenseDimensions");
    expect(resources).not.toContain("expenses");
  });

  it("does not consider a route ready until all of its resources are loaded", () => {
    const dashboardResources = new Set(resourcesForPathname("/"));

    expect(hasLoadedResources("/", dashboardResources, true)).toBe(true);
    expect(hasLoadedResources("/plan", dashboardResources, true)).toBe(false);
  });

  it("lets anonymous dashboard routes finish after capabilities are loaded", () => {
    const anonymousResources = new Set(["capabilities"] as const);

    expect(resourcesForViewer("/", false)).toEqual(["capabilities"]);
    expect(hasLoadedResources("/", anonymousResources, false)).toBe(true);
    expect(hasLoadedResources("/", anonymousResources, true)).toBe(false);
  });

  it("allows background refresh when navigating between routes with loaded resources", () => {
    const loadedResources = new Set([
      ...resourcesForPathname("/"),
      ...resourcesForPathname("/plan"),
    ]);

    expect(hasLoadedResources("/", loadedResources, true)).toBe(true);
    expect(hasLoadedResources("/plan", loadedResources, true)).toBe(true);
  });
});
