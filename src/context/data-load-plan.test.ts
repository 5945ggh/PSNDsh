import { describe, expect, it } from "vitest";
import { hasLoadedResources, resourcesForPathname } from "./data-load-plan";

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

  it("loads the week plan only for the plan route", () => {
    expect(resourcesForPathname("/plan")).toEqual([
      "capabilities",
      "entries",
      "activeFocus",
      "currentWeekPlan",
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

  it("does not consider a route ready until all of its resources are loaded", () => {
    const dashboardResources = new Set(resourcesForPathname("/"));

    expect(hasLoadedResources("/", dashboardResources)).toBe(true);
    expect(hasLoadedResources("/plan", dashboardResources)).toBe(false);
  });

  it("allows background refresh when navigating between routes with loaded resources", () => {
    const loadedResources = new Set([
      ...resourcesForPathname("/"),
      ...resourcesForPathname("/plan"),
    ]);

    expect(hasLoadedResources("/", loadedResources)).toBe(true);
    expect(hasLoadedResources("/plan", loadedResources)).toBe(true);
  });
});
