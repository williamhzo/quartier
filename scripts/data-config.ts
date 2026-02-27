import {
  DEFAULT_SIRENE_NIGHTLIFE_BUCKETS,
  type SireneNightlifeBucket,
} from "./sources/sirene-naf";

export const DIMENSION_KEYS = [
  "housing",
  "income",
  "safety",
  "transport",
  "nightlife",
  "greenSpace",
  "noise",
  "amenities",
] as const;

export type DataDimension = (typeof DIMENSION_KEYS)[number];

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
  enabledDimensions: [
    "housing",
    "income",
    "safety",
    "transport",
  ] as DataDimension[],
  sourceVintages: {
    boundaries: "opendata-paris-arrondissements-snapshot-2026-02-27",
    filosofi: "insee-dossier-complet-2025-10-14",
    dvf_current: "geo-dvf-2024-departement-75",
    dvf_prior: "geo-dvf-2023-departement-75",
    safety: "ssmsi-communal-2024-geographie2025-produit-2025-06-04",
    transport: "idfm-emplacement-des-gares-idf-export-2026-02-27",
    sirene: "V3.11",
  },
  sourceUrls: {
    boundaries: "https://opendata.paris.fr/explore/dataset/arrondissements/",
    filosofi:
      "https://www.insee.fr/fr/statistiques/fichier/5359146/dossier_complet_31_12_2025.zip",
    dvf_current:
      "https://files.data.gouv.fr/geo-dvf/latest/csv/2024/departements/75.csv.gz",
    dvf_prior:
      "https://files.data.gouv.fr/geo-dvf/latest/csv/2023/departements/75.csv.gz",
    safety:
      "https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20250710-144817/donnee-data.gouv-2024-geographie2025-produit-le2025-06-04.csv.gz",
    transport:
      "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/emplacement-des-gares-idf/exports/geojson?where=mode%20in%20(%22METRO%22,%22RER%22)&limit=-1",
    sirene: "https://api.insee.fr/entreprises/sirene/V3.11/siret",
  },
  sources: {
    filosofi: {
      sourceUrl:
        "https://www.insee.fr/fr/statistiques/fichier/5359146/dossier_complet_31_12_2025.zip",
      csvFileName: "dossier_complet.csv",
      cachePath: "data/raw/filosofi/dossier-complet-31-12-2025.zip",
      timeoutMs: 180_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
      fields: {
        code: "CODGEO",
        population: "NBPERSMENFISC21",
        medianIncome: "MED21",
        povertyRate: "TP6021",
      },
    },
    dvf: {
      currentYear: 2024,
      priorYear: 2023,
      departmentCode: "75",
      cacheDir: "data/raw/dvf",
      timeoutMs: 60_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
      outlierLowerQuantile: 0.01,
      outlierUpperQuantile: 0.99,
    },
    safety: {
      sourceUrl:
        "https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20250710-144817/donnee-data.gouv-2024-geographie2025-produit-le2025-06-04.csv.gz",
      cachePath:
        "data/raw/ssmsi/donnee-data.gouv-2024-geographie2025-produit-le2025-06-04.csv.gz",
      year: 2024,
      timeoutMs: 120_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
    },
    transport: {
      sourceUrl:
        "https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/emplacement-des-gares-idf/exports/geojson?where=mode%20in%20(%22METRO%22,%22RER%22)&limit=-1",
      cachePath: "data/raw/idfm/emplacement-des-gares-idf-metro-rer.geojson",
      timeoutMs: 120_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
    },
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
