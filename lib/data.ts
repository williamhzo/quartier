import type { Arrondissement } from "./types";

let cached: Arrondissement[] | null = null;

const DEFAULT_DIMENSIONS: Arrondissement["dimensions"] = {
  housing: null,
  income: null,
  safety: null,
  transport: null,
  nightlife: null,
  greenSpace: null,
  noise: null,
  amenities: null,
  culture: null,
};

const DEFAULT_SCORES: Arrondissement["scores"] = {
  housing: null,
  income: null,
  safety: null,
  transport: null,
  nightlife: null,
  greenSpace: null,
  noise: null,
  amenities: null,
  culture: null,
};

type LoadedArrondissement = Omit<Arrondissement, "dimensions" | "scores"> & {
  dimensions?: Partial<Arrondissement["dimensions"]>;
  scores?: Partial<Arrondissement["scores"]>;
};

function normalizeArrondissement(row: LoadedArrondissement): Arrondissement {
  return {
    ...row,
    dimensions: { ...DEFAULT_DIMENSIONS, ...row.dimensions },
    scores: { ...DEFAULT_SCORES, ...row.scores },
  };
}

export async function loadArrondissements(): Promise<Arrondissement[]> {
  if (cached) return cached;

  try {
    const data = (await import("../data/arrondissements.json"))
      .default as LoadedArrondissement[];
    cached = data.map(normalizeArrondissement);
    return cached;
  } catch {
    return [];
  }
}
