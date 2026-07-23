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

export const QUOTATION_CATALOG_VERSION = "2026.07.22-manual.1";

// This initial offline pack is hand-curated. Per-work source URLs are verified
// when the controlled Gushiwen import process is introduced.
export const QUOTATION_CATALOG: readonly Quotation[] = [
  { id: "spring-rain", season: "spring", text: "好雨知时节，当春乃发生。", author: "杜甫", work: "《春夜喜雨》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
  { id: "spring-breeze", season: "spring", text: "等闲识得东风面，万紫千红总是春。", author: "朱熹", work: "《春日》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
  { id: "summer-lotus", season: "summer", text: "接天莲叶无穷碧，映日荷花别样红。", author: "杨万里", work: "《晓出净慈寺送林子方》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
  { id: "summer-pond", season: "summer", text: "小荷才露尖尖角，早有蜻蜓立上头。", author: "杨万里", work: "《小池》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
  { id: "autumn-mountain", season: "autumn", text: "空山新雨后，天气晚来秋。", author: "王维", work: "《山居秋暝》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
  { id: "autumn-clear", season: "autumn", text: "自古逢秋悲寂寥，我言秋日胜春朝。", author: "刘禹锡", work: "《秋词》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
  { id: "winter-snow", season: "winter", text: "忽如一夜春风来，千树万树梨花开。", author: "岑参", work: "《白雪歌送武判官归京》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
  { id: "winter-plum", season: "winter", text: "墙角数枝梅，凌寒独自开。", author: "王安石", work: "《梅花》", sourceUrl: "https://www.gushiwen.cn/", catalogVersion: QUOTATION_CATALOG_VERSION },
];

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

export const selectSeasonalQuotation = (date: Date, timezone: string): Quotation => {
  const { year, month, day } = localDateParts(date, timezone);
  const candidates = QUOTATION_CATALOG.filter((quotation) => quotation.season === seasonForMonth(month));
  const index = Math.abs(year * 372 + month * 31 + day) % candidates.length;
  return candidates[index]!;
};
