import type { Arrondissement } from "./types";

let cached: Arrondissement[] | null = null;

const DEFAULT_DIMENSIONS: Arrondissement["dimensions"] = {
  housing: null,
  income: null,
  safety: null,
  transport: null,
  greenSpace: null,
  noise: null,
  amenities: null,
  culture: null,
  sports: null,
};

const DEFAULT_SCORES: Arrondissement["scores"] = {
  housing: null,
  income: null,
  safety: null,
  transport: null,
  greenSpace: null,
  noise: null,
  amenities: null,
  culture: null,
  sports: null,
};

type LoadedArrondissement = Omit<Arrondissement, "dimensions" | "scores"> & {
  dimensions?: Partial<Arrondissement["dimensions"]>;
  scores?: Partial<Arrondissement["scores"]>;
};

function normalizeArrondissement(row: LoadedArrondissement): Arrondissement {
  return {
    ...row,
    dimensions: {
      housing: row.dimensions?.housing ?? DEFAULT_DIMENSIONS.housing,
      income: row.dimensions?.income ?? DEFAULT_DIMENSIONS.income,
      safety: row.dimensions?.safety ?? DEFAULT_DIMENSIONS.safety,
      transport: row.dimensions?.transport ?? DEFAULT_DIMENSIONS.transport,
      greenSpace:
        row.dimensions?.greenSpace ?? DEFAULT_DIMENSIONS.greenSpace,
      noise: row.dimensions?.noise ?? DEFAULT_DIMENSIONS.noise,
      amenities: row.dimensions?.amenities ?? DEFAULT_DIMENSIONS.amenities,
      culture: row.dimensions?.culture ?? DEFAULT_DIMENSIONS.culture,
      sports: row.dimensions?.sports ?? DEFAULT_DIMENSIONS.sports,
    },
    scores: {
      housing: row.scores?.housing ?? DEFAULT_SCORES.housing,
      income: row.scores?.income ?? DEFAULT_SCORES.income,
      safety: row.scores?.safety ?? DEFAULT_SCORES.safety,
      transport: row.scores?.transport ?? DEFAULT_SCORES.transport,
      greenSpace: row.scores?.greenSpace ?? DEFAULT_SCORES.greenSpace,
      noise: row.scores?.noise ?? DEFAULT_SCORES.noise,
      amenities: row.scores?.amenities ?? DEFAULT_SCORES.amenities,
      culture: row.scores?.culture ?? DEFAULT_SCORES.culture,
      sports: row.scores?.sports ?? DEFAULT_SCORES.sports,
    },
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
