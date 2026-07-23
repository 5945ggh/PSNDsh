import { z } from "zod";
import autumnPack from "../../../content/quotations/autumn.json";
import springPack from "../../../content/quotations/spring.json";
import summerPack from "../../../content/quotations/summer.json";
import winterPack from "../../../content/quotations/winter.json";

export type QuotationSeason = "spring" | "summer" | "autumn" | "winter";

export type Quotation = {
  id: string;
  season: QuotationSeason;
  text: string;
  author: string;
  work: string;
  sourceUrl: string;
  catalogVersion: string;
};

const quotationSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  author: z.string().trim().min(1),
  work: z.string().trim().min(1),
  sourceUrl: z.string().url(),
  months: z.array(z.number().int().min(1).max(12)).min(1).optional(),
}).strict();

const quotationPackSchema = z.object({
  schemaVersion: z.literal("1.0"),
  catalogVersion: z.string().trim().min(1),
  season: z.enum(["spring", "summer", "autumn", "winter"]),
  months: z.array(z.number().int().min(1).max(12)).min(1),
  quotations: z.array(quotationSchema).min(1),
}).strict().superRefine((pack, context) => {
  const uniqueIds = new Set(pack.quotations.map((quotation) => quotation.id));
  if (uniqueIds.size !== pack.quotations.length) {
    context.addIssue({ code: "custom", message: `${pack.season} 数据包中存在重复 id` });
  }
});

export type QuotationDataPack = z.infer<typeof quotationPackSchema>;

const parsedPacks = [springPack, summerPack, autumnPack, winterPack].map((pack) =>
  quotationPackSchema.parse(pack)
);

const uniquePackSeasons = new Set(parsedPacks.map((pack) => pack.season));
if (uniquePackSeasons.size !== 4) {
  throw new Error("名句数据包必须恰好覆盖春、夏、秋、冬四季");
}

const coveredMonths = parsedPacks.flatMap((pack) => pack.months);
if (new Set(coveredMonths).size !== 12 || coveredMonths.length !== 12) {
  throw new Error("名句数据包必须无重叠地覆盖全部 1-12 月");
}

const quotationIds = parsedPacks.flatMap((pack) => pack.quotations.map((quotation) => quotation.id));
if (new Set(quotationIds).size !== quotationIds.length) {
  throw new Error("名句 id 必须在全部数据包中唯一");
}

const catalogVersions = new Set(parsedPacks.map((pack) => pack.catalogVersion));
if (catalogVersions.size !== 1) {
  throw new Error("同一发布版本的名句数据包必须使用相同 catalogVersion");
}

export const QUOTATION_DATA_PACKS: readonly QuotationDataPack[] = parsedPacks;
export const QUOTATION_CATALOG_VERSION = parsedPacks[0]!.catalogVersion;

export const QUOTATION_CATALOG: readonly Quotation[] = parsedPacks.flatMap((pack) =>
  pack.quotations.map((quotation) => ({
    id: quotation.id,
    season: pack.season,
    text: quotation.text,
    author: quotation.author,
    work: quotation.work,
    sourceUrl: quotation.sourceUrl,
    catalogVersion: pack.catalogVersion,
  }))
);

const localDateParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day") };
};

export const seasonForMonth = (month: number): QuotationSeason => {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
};

const stableIndex = (year: number, month: number, day: number, count: number) =>
  Math.abs(year * 372 + month * 31 + day) % count;

export const selectSeasonalQuotation = (date: Date, timezone: string): Quotation => {
  const { year, month, day } = localDateParts(date, timezone);
  const pack = parsedPacks.find((candidate) => candidate.months.includes(month));
  if (!pack) throw new Error(`没有覆盖 ${month} 月的名句数据包`);

  const candidates = pack.quotations.filter(
    (quotation) => !quotation.months || quotation.months.includes(month)
  );
  const selected = candidates[stableIndex(year, month, day, candidates.length)];
  if (!selected) throw new Error(`${pack.season} 数据包中没有可展示的名句`);

  return {
    id: selected.id,
    season: pack.season,
    text: selected.text,
    author: selected.author,
    work: selected.work,
    sourceUrl: selected.sourceUrl,
    catalogVersion: pack.catalogVersion,
  };
};
