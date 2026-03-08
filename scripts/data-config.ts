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
  "culture",
  "sports",
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
    "greenSpace",
    "noise",
    "amenities",
    "culture",
    "sports",
  ] as DataDimension[],
  sourceVintages: {
    boundaries: "opendata-paris-arrondissements-snapshot-2026-02-27",
    filosofi: "insee-dossier-complet-2025-10-14",
    dvf_current: "geo-dvf-2024-departement-75",
    dvf_prior: "geo-dvf-2023-departement-75",
    safety: "ssmsi-communal-2024-geographie2025-produit-2025-06-04",
    transport: "idfm-emplacement-des-gares-idf-export-2026-02-27",
    greenSpace: "opendata-paris-espaces-verts-export-2026-02-28",
    noise: "ville-paris-bruit-routier-cnossos-2022",
    bpe: "buildingref-france-bpe-all-millesime-2016",
    culture: "basilic-2026-02-18",
    sirene: "stock-etablissement-2026-03-08",
    sports: "data-es-open-daily-v1",
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
    greenSpace:
      "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/espaces_verts/exports/geojson?limit=-1",
    noise:
      "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/bruit-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journ/exports/csv",
    bpe: "https://public.opendatasoft.com/explore/dataset/buildingref-france-bpe-all-millesime/",
    culture:
      "https://data.culture.gouv.fr/explore/dataset/base-des-lieux-et-des-equipements-culturels/",
    sirene:
      "https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/",
    sports:
      "https://equipements.sports.gouv.fr/api/explore/v2.1/catalog/datasets/data-es/records",
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
    greenSpace: {
      sourceUrl:
        "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/espaces_verts/exports/geojson?limit=-1",
      cachePath: "data/raw/green-space/espaces-verts.geojson",
      timeoutMs: 180_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
    },
    noise: {
      sourceUrl:
        "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/bruit-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journ/exports/csv",
      cachePath:
        "data/raw/noise/bruit-exposition-des-parisien-ne-s-aux-depassements-des-seuils.csv",
      year: 2022,
      timeoutMs: 120_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
    },
    bpe: {
      apiBaseUrl:
        "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/buildingref-france-bpe-all-millesime/records",
      sourceUrl:
        "https://public.opendatasoft.com/explore/dataset/buildingref-france-bpe-all-millesime/",
      cachePath: "data/raw/bpe/amenities-paris-2016.json",
      year: "2016-01-01",
      timeoutMs: 120_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
      maxRecords: 2_000,
      equipmentCodes: {
        pharmacies: ["D301"],
        doctors: [
          "D201",
          "D202",
          "D203",
          "D204",
          "D205",
          "D206",
          "D207",
          "D208",
          "D209",
          "D210",
          "D211",
          "D212",
          "D213",
        ],
        schools: [
          "C101",
          "C102",
          "C104",
          "C105",
          "C201",
          "C301",
          "C302",
          "C303",
        ],
        gyms: ["F120", "F121"],
        cinemas: ["F303"],
      },
    },
    culture: {
      apiBaseUrl:
        "https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/base-des-lieux-et-des-equipements-culturels/exports/json",
      sourceUrl:
        "https://data.culture.gouv.fr/explore/dataset/base-des-lieux-et-des-equipements-culturels/",
      cachePath: "data/raw/culture/basilic-paris.json",
      timeoutMs: 180_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
      maxRecords: 10_000,
      typeMapping: {
        cinemas: ["Cinéma"],
        libraries: ["Bibliothèque"],
        heritage: [
          "Monument",
          "Lieu de mémoire",
          "Lieu archéologique",
          "Espace protégé",
        ],
        livePerformanceVenues: [
          "Théâtre",
          "Opéra",
          "Scène",
          "Conservatoire",
          "Centre de création artistique",
          "Centre de création musicale",
        ],
        archives: ["Service d'archives"],
        museums: ["Musée", "Centre d'art"],
      },
    },
    sirene: {
      sourceUrl:
        "https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/",
      stockPath: "data/raw/sirene/StockEtablissement_utf8.parquet",
      snapshotPath: "data/nightlife-snapshot.json",
      generatorScriptPath: "scripts/generate_sirene_nightlife_snapshot.py",
      enabledNightlifeBuckets: DEFAULT_SIRENE_NIGHTLIFE_BUCKETS,
      includeNightlifeExtension: false,
      expectedNomenclatures: ["NAFRev2"] as const,
    },
    sports: {
      apiBaseUrl:
        "https://equipements.sports.gouv.fr/api/explore/v2.1/catalog/datasets/data-es/records",
      sourceUrl: "https://equipements.sports.gouv.fr/explore/dataset/data-es/",
      cachePath: "data/raw/sports/data-es-paris.json",
      timeoutMs: 120_000,
      maxRetries: 3,
      initialRetryDelayMs: 500,
      maxRecords: 5_000,
      departmentCode: "75",
      bucketMapping: {
        fitness: [
          "Salles de remise en forme",
          "Salles de fitness",
          "Remise en forme",
          "Equipement d'activités de forme et de santé",
        ],
        tennis: ["Courts de tennis", "Court de tennis", "Tennis"],
        swimming: [
          "Bassins de natation",
          "Bassin de natation",
          "Piscines",
          "Natation",
          "Site d'activités aquatiques et nautiques",
        ],
        multisport: [
          "Salles + Plateaux multisports",
          "Salles multisports",
          "Salle multisports",
          "Plateaux multisports",
          "Multisports/City-stades",
          "Salle ou terrain spécialisé",
          "Salle non spécialisée",
          "Structure Artificielle d'Escalade",
          "Skatepark & vélo Freestyle",
          "Boulodrome",
          "Bowling",
          "Aire de sports de glaces",
          "Mur et fronton",
          "Parcours de golf",
          "Parcours sportif/santé",
          "Equipement équestre",
          "Equipement de cyclisme",
          "Divers équipements",
          "Site d'activités aériennes",
          "Pas de tir",
        ],
        combat: [
          "Salles de combat",
          "Salle de combat",
          "Sports de combat",
          "Dojos",
        ],
        athletics: [
          "Equipements d'athletisme",
          "Equipement d'athlétisme",
          "Athletisme",
          "Stades d'athletisme",
        ],
        team_sports: [
          "Grands terrains de sports collectifs",
          "Petits terrains de sports collectifs",
          "Terrains de sports collectifs",
          "Terrain de grands jeux",
          "Terrain extérieur de petits jeux collectifs",
        ],
      },
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
