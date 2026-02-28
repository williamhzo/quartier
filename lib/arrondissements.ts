export const ARRONDISSEMENT_NAMES: Record<number, string> = {
  1: "1er arrondissement",
  2: "2e arrondissement",
  3: "3e arrondissement",
  4: "4e arrondissement",
  5: "5e arrondissement",
  6: "6e arrondissement",
  7: "7e arrondissement",
  8: "8e arrondissement",
  9: "9e arrondissement",
  10: "10e arrondissement",
  11: "11e arrondissement",
  12: "12e arrondissement",
  13: "13e arrondissement",
  14: "14e arrondissement",
  15: "15e arrondissement",
  16: "16e arrondissement",
  17: "17e arrondissement",
  18: "18e arrondissement",
  19: "19e arrondissement",
  20: "20e arrondissement",
};

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

export function arrondissementSuffix(n: number): string {
  return n === 1 ? "er" : "e";
}

export function formatArrondissement(n: number): string {
  return `${n}${arrondissementSuffix(n)}`;
}
