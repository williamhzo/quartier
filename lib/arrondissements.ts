function ordinalSuffixEn(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

export function arrondissementSuffix(
  n: number,
  locale: string = "fr",
): string {
  if (locale === "fr") return n === 1 ? "er" : "e";
  return ordinalSuffixEn(n);
}

export function formatArrondissement(
  n: number,
  locale: string = "fr",
): string {
  if (locale === "fr") return `${n}${n === 1 ? "er" : "e"}`;
  return `${n}${ordinalSuffixEn(n)} arr.`;
}

export function arrondissementName(n: number, locale: string = "fr"): string {
  if (locale === "fr") return `${formatArrondissement(n, "fr")} arrondissement`;
  return formatArrondissement(n, "en");
}

export function ordinalLabel(n: number, locale: string = "fr"): string {
  if (locale === "fr") return formatArrondissement(n, "fr");
  return `${n}${ordinalSuffixEn(n)}`;
}

export const ARRONDISSEMENT_CODES: Record<number, string> = {
  1: "75101",
  2: "75102",
  3: "75103",
  4: "75104",
  5: "75105",
  6: "75106",
  7: "75107",
  8: "75108",
  9: "75109",
  10: "75110",
  11: "75111",
  12: "75112",
  13: "75113",
  14: "75114",
  15: "75115",
  16: "75116",
  17: "75117",
  18: "75118",
  19: "75119",
  20: "75120",
};

export const DIMENSION_KEYS = [
  "housing",
  "income",
  "safety",
  "transport",
  "nightlife",
  "greenSpace",
  "noise",
  "amenities",
  "culture",
  "sports",
] as const;
