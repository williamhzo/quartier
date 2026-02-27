import type { Arrondissement } from "./types";

let cached: Arrondissement[] | null = null;

export async function loadArrondissements(): Promise<Arrondissement[]> {
  if (cached) return cached;

  try {
    const data = (await import("../data/arrondissements.json")).default;
    cached = data as Arrondissement[];
    return cached;
  } catch {
    return [];
  }
}
