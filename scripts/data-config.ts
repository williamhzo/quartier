import {
  DEFAULT_SIRENE_NIGHTLIFE_BUCKETS,
  type SireneNightlifeBucket,
} from "./sources/sirene-naf";

export const PARIS_ARRONDISSEMENT_COMMUNES = [
  "75101",
  "75102",
  "75103",
  "75104",
  "75105",
  "75106",
  "75107",
  "75108",
  "75109",
  "75110",
  "75111",
  "75112",
  "75113",
  "75114",
  "75115",
  "75116",
  "75117",
  "75118",
  "75119",
  "75120",
] as const;

export const DATA_CONFIG = {
  enabledDimensions: ["housing", "income", "safety", "transport"] as const,
  sources: {
    sirene: {
      apiVersion: "V3.11",
      baseUrl: "https://api.insee.fr/entreprises/sirene/V3.11/siret",
      enabledNightlifeBuckets: DEFAULT_SIRENE_NIGHTLIFE_BUCKETS,
      includeNightlifeExtension: false,
      expectedNomenclatures: ["NAFRev2"] as const,
    },
  },
};

export function getEnabledSireneBuckets(): SireneNightlifeBucket[] {
  const buckets = [...DATA_CONFIG.sources.sirene.enabledNightlifeBuckets];

  if (DATA_CONFIG.sources.sirene.includeNightlifeExtension) {
    buckets.push("nightlife_extension");
  }

  return buckets;
}
