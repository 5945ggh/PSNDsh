import { describe, expect, it } from "vitest";
import {
  QUOTATION_CATALOG,
  QUOTATION_CATALOG_VERSION,
  QUOTATION_DATA_PACKS,
  selectSeasonalQuotation,
} from "./quotations";

describe("local quotation catalog", () => {
  it("covers all four seasons with traceable, versioned local content", () => {
    expect(new Set(QUOTATION_CATALOG.map((quotation) => quotation.season))).toEqual(
      new Set(["spring", "summer", "autumn", "winter"])
    );
    for (const quotation of QUOTATION_CATALOG) {
      expect(quotation.text).not.toBe("");
      expect(quotation.author).not.toBe("");
      expect(quotation.work).not.toBe("");
      expect(quotation.sourceUrl).toMatch(/^https:\/\//);
      expect(quotation.catalogVersion).toBe(QUOTATION_CATALOG_VERSION);
    }
  });

  it("loads four version-consistent data packs that cover every month exactly once", () => {
    expect(QUOTATION_DATA_PACKS.map((pack) => pack.season)).toEqual([
      "spring",
      "summer",
      "autumn",
      "winter",
    ]);
    expect(QUOTATION_DATA_PACKS.flatMap((pack) => pack.months).sort((left, right) => left - right))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(QUOTATION_DATA_PACKS.map((pack) => pack.catalogVersion))).toEqual(
      new Set([QUOTATION_CATALOG_VERSION])
    );
  });

  it("chooses a stable local quotation from the effective timezone", () => {
    const date = new Date("2026-06-21T16:30:00.000Z");
    const first = selectSeasonalQuotation(date, "Asia/Shanghai");
    const second = selectSeasonalQuotation(date, "Asia/Shanghai");

    expect(first).toEqual(second);
    expect(first.season).toBe("summer");
  });
});
