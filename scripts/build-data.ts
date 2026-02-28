import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DATA_CONFIG,
  DIMENSION_KEYS,
  PARIS_ARRONDISSEMENT_COMMUNES,
  getEnabledSireneBuckets,
  type DataDimension,
} from "./data-config";
import { buildHousingFromDvf, type HousingMetric } from "./sources/dvf";
import {
  loadIncomePopulationFromFilosofi,
  type IncomeMetric,
} from "./sources/filosofi";
import { buildSafetyFromSsmsi, type SafetyMetric } from "./sources/crime";
import {
  buildTransportFromIdfm,
  type TransportMetric,
} from "./sources/transport";
import { buildNoiseFromRoadExposure, type NoiseMetric } from "./sources/noise";
import {
  buildAmenitiesFromBpe,
  type AmenitiesMetric,
} from "./sources/amenities";
import {
  buildGreenSpaceFromParisOpenData,
  type GreenSpaceMetric,
} from "./sources/green-space";
import {
  buildNightlifeFromSirene,
  buildSireneNightlifeCachePagePath,
  type NightlifeMetric,
} from "./sources/sirene";
import { buildSireneNightlifeSearchParams } from "./sources/sirene-query";

type BuildOptions = {
  offline: boolean;
};

type BoundaryFeatureProperties = {
  c_arinsee?: number | string;
  c_ar?: number | string;
  surface?: number;
  [key: string]: unknown;
};

type BoundaryFeature = {
  type: "Feature";
  properties?: BoundaryFeatureProperties;
  geometry: unknown;
  id?: string | number;
};

type BoundaryCollection = {
  type: "FeatureCollection";
  features: BoundaryFeature[];
  [key: string]: unknown;
};

type ArrondissementDimensions = {
  housing: HousingMetric | null;
  income: IncomeMetric | null;
  safety: SafetyMetric | null;
  transport: TransportMetric | null;
  nightlife: NightlifeMetric | null;
  greenSpace: GreenSpaceMetric | null;
  noise: NoiseMetric | null;
  amenities: AmenitiesMetric | null;
  culture: CultureMetric | null;
};
type ArrondissementScores = Record<DataDimension, number | null>;

type CultureMetric = {
  cultural_buildings_total: number;
  cultural_buildings_per_km2: number;
  cultural_buildings_per_10k_residents: number;
  by_type: {
    cinemas: number;
  };
};

type ArrondissementRow = {
  code: string;
  number: number;
  name: string;
  population: number;
  area_km2: number;
  dimensions: ArrondissementDimensions;
  scores: ArrondissementScores;
};

type BuildQuality = {
  hard_fail_checks_passed: boolean;
  hard_fail_errors: string[];
  warnings: string[];
  coverage_by_dimension: Record<DataDimension, number>;
};

type DataMetadata = {
  generated_at: string;
  enabled_dimensions: DataDimension[];
  source_vintages: Record<string, string>;
  source_urls: Record<string, string>;
  source_row_counts: Record<string, number>;
  source_checksums: Record<string, string>;
  quality: BuildQuality;
};

type BuildSourceContributions = {
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

type DriftBaseline = {
  metadata: DataMetadata | null;
  rows: ArrondissementRow[] | null;
  warnings: string[];
};

const ARRONDISSEMENTS_PATH = path.join(
  process.cwd(),
  "data",
  "arrondissements.json",
);
const METADATA_PATH = path.join(process.cwd(), "data", "metadata.json");
const BOUNDARIES_PATH = path.join(
  process.cwd(),
  "data",
  "arrondissements.geojson",
);
const SIRENE_CACHE_ROOT = path.join(process.cwd(), "data", "raw", "sirene");
const ROW_COUNT_DRIFT_WARN_THRESHOLD_PCT = 15;
const METRIC_DRIFT_WARN_THRESHOLD_PCT = 20;

function parseOptions(argv: string[]): BuildOptions {
  return {
    offline: argv.includes("--offline"),
  };
}

function isMissingFileError(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === "ENOENT" || String(error).includes("ENOENT");
}

async function validateNightlifeOfflineCacheReadiness(): Promise<void> {
  const buckets = getEnabledSireneBuckets();
  const missingCommunes: string[] = [];

  for (const communeCode of PARIS_ARRONDISSEMENT_COMMUNES) {
    const query = buildSireneNightlifeSearchParams(communeCode, buckets).get(
      "q",
    );
    if (!query) {
      throw new Error(`failed to build nightlife query for ${communeCode}`);
    }

    const firstPagePath = buildSireneNightlifeCachePagePath({
      cacheDir: SIRENE_CACHE_ROOT,
      communeCode,
      query,
      pageOffset: 0,
    });

    try {
      await readFile(firstPagePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        missingCommunes.push(communeCode);
        continue;
      }
      throw error;
    }
  }

  if (missingCommunes.length === 0) {
    return;
  }

  const previewLimit = 8;
  const preview = missingCommunes.slice(0, previewLimit).join(", ");
  const remainder = missingCommunes.length - Math.min(missingCommunes.length, previewLimit);
  const suffix = remainder > 0 ? ` (+${remainder} more)` : "";

  throw new Error(
    `nightlife is enabled but offline SIRENE cache is incomplete: missing first page for ${missingCommunes.length}/${PARIS_ARRONDISSEMENT_COMMUNES.length} communes (${preview}${suffix}). In --offline mode prewarm cache with: bun run data:refresh --dimensions=nightlife --all`,
  );
}

async function validateBuildPreconditions(
  mode: "network-first" | "cache-only",
): Promise<void> {
  if (!DATA_CONFIG.enabledDimensions.includes("nightlife")) {
    return;
  }
  if (mode !== "cache-only") {
    return;
  }

  await validateNightlifeOfflineCacheReadiness();
}

function assertParisCode(value: unknown): string {
  const code = String(value ?? "");
  if (!/^751(0[1-9]|1\d|20)$/.test(code)) {
    throw new Error(`invalid arrondissement code: ${code}`);
  }
  return code;
}

function toArrondissementName(number: number): string {
  return `${number}${number === 1 ? "er" : "e"} arrondissement`;
}

function createNullDimensions(): ArrondissementDimensions {
  return {
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
}

function createNullScores(): ArrondissementScores {
  return {
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
}

function buildRows(
  boundaries: BoundaryCollection,
  populationByCode: Map<string, number>,
): ArrondissementRow[] {
  const rows: ArrondissementRow[] = [];

  for (const feature of boundaries.features) {
    const props = feature.properties ?? {};
    const rawCode = props.c_arinsee;
    if (rawCode == null) continue;

    const code = assertParisCode(rawCode);
    const number = Number(props.c_ar ?? Number(code.slice(3)));
    const areaSquareMeters = Number(props.surface);

    if (!Number.isFinite(number) || number < 1 || number > 20) {
      throw new Error(
        `invalid arrondissement number for ${code}: ${props.c_ar}`,
      );
    }

    if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0) {
      throw new Error(`invalid area surface for ${code}: ${props.surface}`);
    }

    const population = populationByCode.get(code);
    if (!population) {
      throw new Error(`missing population for ${code}`);
    }

    rows.push({
      code,
      number,
      name: toArrondissementName(number),
      population,
      area_km2: Number((areaSquareMeters / 1_000_000).toFixed(6)),
      dimensions: createNullDimensions(),
      scores: createNullScores(),
    });
  }

  rows.sort((a, b) => a.number - b.number);
  return rows;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error("cannot compute median on empty array");
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isDataMetadataLike(value: unknown): value is DataMetadata {
  if (!isRecord(value)) return false;
  return isRecord(value.source_row_counts);
}

function isArrondissementRowLike(value: unknown): value is ArrondissementRow {
  if (!isRecord(value)) return false;
  return typeof value.code === "string" && isRecord(value.dimensions);
}

async function readOptionalJson(
  filePath: string,
  label: string,
): Promise<{ value: unknown | null; warning: string | null }> {
  try {
    const raw = await readFile(filePath, "utf8");
    return { value: JSON.parse(raw), warning: null };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return { value: null, warning: null };
    }

    return {
      value: null,
      warning: `unable to load previous ${label} for drift checks: ${readErrorMessage(error)}`,
    };
  }
}

async function loadDriftBaseline(): Promise<DriftBaseline> {
  const [metadataResult, rowsResult] = await Promise.all([
    readOptionalJson(METADATA_PATH, "metadata"),
    readOptionalJson(ARRONDISSEMENTS_PATH, "arrondissements"),
  ]);

  const warnings: string[] = [];
  let metadata: DataMetadata | null = null;
  let rows: ArrondissementRow[] | null = null;

  if (metadataResult.warning) {
    warnings.push(metadataResult.warning);
  } else if (metadataResult.value != null) {
    if (isDataMetadataLike(metadataResult.value)) {
      metadata = metadataResult.value as DataMetadata;
    } else {
      warnings.push(
        "unable to use previous metadata for drift checks: invalid JSON shape",
      );
    }
  }

  if (rowsResult.warning) {
    warnings.push(rowsResult.warning);
  } else if (rowsResult.value != null) {
    if (Array.isArray(rowsResult.value)) {
      const validRows = rowsResult.value.filter(isArrondissementRowLike);
      if (validRows.length < rowsResult.value.length) {
        warnings.push(
          "previous arrondissements for drift checks contained malformed rows; ignoring invalid entries",
        );
      }
      rows = validRows;
    } else {
      warnings.push(
        "unable to use previous arrondissements for drift checks: invalid JSON shape",
      );
    }
  }

  return { metadata, rows, warnings };
}

function collectRowCountDriftWarnings(
  currentRowCounts: Record<string, number>,
  previousMetadata: DataMetadata | null,
): string[] {
  if (!previousMetadata?.source_row_counts) return [];

  const warnings: string[] = [];
  for (const [sourceKey, currentCount] of Object.entries(currentRowCounts)) {
    const previousCount = previousMetadata.source_row_counts[sourceKey];
    if (!Number.isFinite(previousCount) || previousCount <= 0) continue;
    if (!Number.isFinite(currentCount) || currentCount < 0) continue;

    const deltaPct = ((currentCount - previousCount) / previousCount) * 100;
    if (Math.abs(deltaPct) < ROW_COUNT_DRIFT_WARN_THRESHOLD_PCT) continue;

    warnings.push(
      `source row-count drift for "${sourceKey}": ${previousCount} -> ${currentCount} (${round(deltaPct, 2)}%)`,
    );
  }

  return warnings;
}

function collectMetricDriftWarnings(
  currentRows: ArrondissementRow[],
  previousRows: ArrondissementRow[] | null,
): string[] {
  if (!previousRows) return [];

  const previousByCode = new Map(
    previousRows.map((row) => [row.code, row] as const),
  );
  const warnings: string[] = [];

  for (const dimension of DATA_CONFIG.enabledDimensions) {
    const currentValues: number[] = [];
    const previousValues: number[] = [];

    for (const row of currentRows) {
      const previous = previousByCode.get(row.code);
      if (!previous) continue;

      const currentRaw = getRawMetricForDimension(row, dimension);
      const previousRaw = getRawMetricForDimension(previous, dimension);
      if (
        currentRaw == null ||
        previousRaw == null ||
        !Number.isFinite(currentRaw) ||
        !Number.isFinite(previousRaw)
      ) {
        continue;
      }

      currentValues.push(currentRaw);
      previousValues.push(previousRaw);
    }

    if (previousValues.length === 0) {
      continue;
    }

    const previousMedian = median(previousValues);
    if (!Number.isFinite(previousMedian) || previousMedian <= 0) {
      continue;
    }

    const currentMedian = median(currentValues);
    const deltaPct = ((currentMedian - previousMedian) / previousMedian) * 100;
    if (Math.abs(deltaPct) < METRIC_DRIFT_WARN_THRESHOLD_PCT) {
      continue;
    }

    warnings.push(
      `metric drift for "${dimension}" median raw value: ${round(previousMedian, 2)} -> ${round(currentMedian, 2)} (${round(deltaPct, 2)}%)`,
    );
  }

  return warnings;
}

async function applyHousingDimension(
  rows: ArrondissementRow[],
  mode: "network-first" | "cache-only",
): Promise<BuildSourceContributions> {
  if (!DATA_CONFIG.enabledDimensions.includes("housing")) {
    return {
      sourceRowCounts: {},
      sourceChecksums: {},
      sourceUrls: {},
      warnings: [],
    };
  }

  const housing = await buildHousingFromDvf({
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    mode,
    config: DATA_CONFIG.sources.dvf,
  });

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of housing.byCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;
    row.dimensions.housing = metric;
  }

  return {
    sourceRowCounts: housing.sourceRowCounts,
    sourceChecksums: housing.sourceChecksums,
    sourceUrls: housing.sourceUrls,
    warnings: housing.warnings,
  };
}

async function applySafetyDimension(
  rows: ArrondissementRow[],
  mode: "network-first" | "cache-only",
): Promise<BuildSourceContributions> {
  if (!DATA_CONFIG.enabledDimensions.includes("safety")) {
    return {
      sourceRowCounts: {},
      sourceChecksums: {},
      sourceUrls: {},
      warnings: [],
    };
  }

  const populationByCommune = new Map(
    rows.map((row) => [row.code, row.population] as const),
  );
  const safety = await buildSafetyFromSsmsi({
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    populationByCommune,
    mode,
    config: DATA_CONFIG.sources.safety,
  });

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of safety.byCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;
    row.dimensions.safety = metric;
  }

  return {
    sourceRowCounts: safety.sourceRowCounts,
    sourceChecksums: safety.sourceChecksums,
    sourceUrls: safety.sourceUrls,
    warnings: safety.warnings,
  };
}

async function applyTransportDimension(
  rows: ArrondissementRow[],
  boundaries: BoundaryCollection,
  mode: "network-first" | "cache-only",
): Promise<BuildSourceContributions> {
  if (!DATA_CONFIG.enabledDimensions.includes("transport")) {
    return {
      sourceRowCounts: {},
      sourceChecksums: {},
      sourceUrls: {},
      warnings: [],
    };
  }

  const geometryByCode = new Map<string, unknown>();
  for (const feature of boundaries.features) {
    const props = feature.properties ?? {};
    const rawCode = props.c_arinsee;
    if (rawCode == null) continue;
    geometryByCode.set(assertParisCode(rawCode), feature.geometry);
  }

  const boundariesForParser = rows.map((row) => {
    const geometry = geometryByCode.get(row.code);
    if (!geometry) {
      throw new Error(`missing boundary geometry for transport: ${row.code}`);
    }

    return {
      code: row.code,
      area_km2: row.area_km2,
      geometry,
    };
  });

  const transport = await buildTransportFromIdfm({
    boundaries: boundariesForParser,
    mode,
    config: DATA_CONFIG.sources.transport,
  });

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of transport.byCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;
    row.dimensions.transport = metric;
  }

  return {
    sourceRowCounts: transport.sourceRowCounts,
    sourceChecksums: transport.sourceChecksums,
    sourceUrls: transport.sourceUrls,
    warnings: transport.warnings,
  };
}

async function applyNoiseDimension(
  rows: ArrondissementRow[],
  mode: "network-first" | "cache-only",
): Promise<BuildSourceContributions> {
  if (!DATA_CONFIG.enabledDimensions.includes("noise")) {
    return {
      sourceRowCounts: {},
      sourceChecksums: {},
      sourceUrls: {},
      warnings: [],
    };
  }

  const populationByCommune = new Map(
    rows.map((row) => [row.code, row.population] as const),
  );
  const noise = await buildNoiseFromRoadExposure({
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    populationByCommune,
    mode,
    config: DATA_CONFIG.sources.noise,
  });

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of noise.byCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;
    row.dimensions.noise = metric;
  }

  return {
    sourceRowCounts: noise.sourceRowCounts,
    sourceChecksums: noise.sourceChecksums,
    sourceUrls: noise.sourceUrls,
    warnings: noise.warnings,
  };
}

async function applyGreenSpaceDimension(
  rows: ArrondissementRow[],
  boundaries: BoundaryCollection,
  mode: "network-first" | "cache-only",
): Promise<BuildSourceContributions> {
  if (!DATA_CONFIG.enabledDimensions.includes("greenSpace")) {
    return {
      sourceRowCounts: {},
      sourceChecksums: {},
      sourceUrls: {},
      warnings: [],
    };
  }

  const geometryByCode = new Map<string, unknown>();
  for (const feature of boundaries.features) {
    const props = feature.properties ?? {};
    const rawCode = props.c_arinsee;
    if (rawCode == null) continue;
    geometryByCode.set(assertParisCode(rawCode), feature.geometry);
  }

  const boundariesForParser = rows.map((row) => {
    const geometry = geometryByCode.get(row.code);
    if (!geometry) {
      throw new Error(`missing boundary geometry for green-space: ${row.code}`);
    }

    return {
      code: row.code,
      geometry,
    };
  });

  const populationByCommune = new Map(
    rows.map((row) => [row.code, row.population] as const),
  );
  const greenSpace = await buildGreenSpaceFromParisOpenData({
    boundaries: boundariesForParser,
    populationByCommune,
    mode,
    config: DATA_CONFIG.sources.greenSpace,
  });

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of greenSpace.byCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;
    row.dimensions.greenSpace = metric;
  }

  return {
    sourceRowCounts: greenSpace.sourceRowCounts,
    sourceChecksums: greenSpace.sourceChecksums,
    sourceUrls: greenSpace.sourceUrls,
    warnings: greenSpace.warnings,
  };
}

async function applyNightlifeDimension(
  rows: ArrondissementRow[],
  mode: "network-first" | "cache-only",
): Promise<BuildSourceContributions> {
  if (!DATA_CONFIG.enabledDimensions.includes("nightlife")) {
    return {
      sourceRowCounts: {},
      sourceChecksums: {},
      sourceUrls: {},
      warnings: [],
    };
  }

  const areaByCommune = new Map(rows.map((row) => [row.code, row.area_km2]));
  const nightlife = await buildNightlifeFromSirene({
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    areaByCommune,
    buckets: getEnabledSireneBuckets(),
    mode,
    accessToken: process.env.SIRENE_API_TOKEN ?? "",
    expectedNomenclatures: DATA_CONFIG.sources.sirene.expectedNomenclatures,
  });

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of nightlife.byCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;
    row.dimensions.nightlife = metric;
  }

  return {
    sourceRowCounts: nightlife.sourceRowCounts,
    sourceChecksums: nightlife.sourceChecksums,
    sourceUrls: nightlife.sourceUrls,
    warnings: nightlife.warnings,
  };
}

const EXPECTED_CULTURE_BPE_CODEBOOK = {
  cinemas: ["F303"],
} as const;

function assertPinnedCultureCodebook(): void {
  const configuredCodebook = DATA_CONFIG.sources.bpe.cultureCodebook?.byType;
  if (!configuredCodebook) {
    throw new Error("missing bpe cultureCodebook config");
  }

  const configuredTypes = Object.keys(configuredCodebook).sort();
  const expectedTypes = Object.keys(EXPECTED_CULTURE_BPE_CODEBOOK).sort();

  if (configuredTypes.join(",") !== expectedTypes.join(",")) {
    throw new Error(
      `bpe culture codebook drift: expected types [${expectedTypes.join(", ")}], got [${configuredTypes.join(", ")}]`,
    );
  }

  const configuredCinemas = [...(configuredCodebook.cinemas ?? [])].sort();
  const expectedCinemas = [...EXPECTED_CULTURE_BPE_CODEBOOK.cinemas].sort();
  if (configuredCinemas.join(",") !== expectedCinemas.join(",")) {
    throw new Error(
      `bpe culture codebook drift for "cinemas": expected [${expectedCinemas.join(", ")}], got [${configuredCinemas.join(", ")}]`,
    );
  }

  const amenitiesCinemaCodes = [...DATA_CONFIG.sources.bpe.equipmentCodes.cinemas]
    .sort();
  if (amenitiesCinemaCodes.join(",") !== expectedCinemas.join(",")) {
    throw new Error(
      `bpe culture codebook drift: amenities cinema codes must match pinned culture codes [${expectedCinemas.join(", ")}]`,
    );
  }
}

function toCultureMetric(
  cinemas: number,
  areaKm2: number,
  population: number,
): CultureMetric | null {
  if (
    !Number.isFinite(cinemas) ||
    cinemas < 0 ||
    !Number.isFinite(areaKm2) ||
    areaKm2 <= 0 ||
    !Number.isFinite(population) ||
    population <= 0
  ) {
    return null;
  }

  return {
    cultural_buildings_total: round(cinemas, 2),
    cultural_buildings_per_km2: round(cinemas / areaKm2, 2),
    cultural_buildings_per_10k_residents: round((cinemas / population) * 10_000, 2),
    by_type: {
      cinemas: round(cinemas, 2),
    },
  };
}

async function applyAmenitiesDimension(
  rows: ArrondissementRow[],
  mode: "network-first" | "cache-only",
): Promise<BuildSourceContributions> {
  const amenitiesEnabled = DATA_CONFIG.enabledDimensions.includes("amenities");
  const cultureEnabled = DATA_CONFIG.enabledDimensions.includes("culture");
  if (!amenitiesEnabled && !cultureEnabled) {
    return {
      sourceRowCounts: {},
      sourceChecksums: {},
      sourceUrls: {},
      warnings: [],
    };
  }

  if (cultureEnabled) {
    assertPinnedCultureCodebook();
  }

  const amenities = await buildAmenitiesFromBpe({
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    mode,
    config: DATA_CONFIG.sources.bpe,
  });

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of amenities.byCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;

    if (amenitiesEnabled) {
      row.dimensions.amenities = metric;
    }
    if (cultureEnabled) {
      row.dimensions.culture = toCultureMetric(
        metric.cinemas,
        row.area_km2,
        row.population,
      );
    }
  }

  return {
    sourceRowCounts: amenities.sourceRowCounts,
    sourceChecksums: amenities.sourceChecksums,
    sourceUrls: amenities.sourceUrls,
    warnings: amenities.warnings,
  };
}

function applyIncomeDimension(
  rows: ArrondissementRow[],
  incomeByCommune: Map<string, IncomeMetric>,
): void {
  if (!DATA_CONFIG.enabledDimensions.includes("income")) {
    return;
  }

  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));
  for (const [code, metric] of incomeByCommune) {
    const row = rowByCode.get(code);
    if (!row) continue;
    row.dimensions.income = metric;
  }
}

function getRawMetricForDimension(
  row: ArrondissementRow,
  dimension: DataDimension,
): number | null {
  if (dimension === "housing") {
    return row.dimensions.housing?.median_price_m2 ?? null;
  }
  if (dimension === "income") {
    return row.dimensions.income?.median_household ?? null;
  }
  if (dimension === "safety") {
    return row.dimensions.safety?.crime_rate_per_1k ?? null;
  }
  if (dimension === "transport") {
    return row.dimensions.transport?.stations_per_km2 ?? null;
  }
  if (dimension === "nightlife") {
    if (!row.dimensions.nightlife) return null;
    return (
      row.dimensions.nightlife.restaurants_per_km2 +
      row.dimensions.nightlife.bars_per_km2
    );
  }
  if (dimension === "greenSpace") {
    return row.dimensions.greenSpace?.m2_per_resident ?? null;
  }
  if (dimension === "noise") {
    return row.dimensions.noise?.pct_above_lden_threshold ?? null;
  }
  if (dimension === "amenities") {
    const amenities = row.dimensions.amenities;
    if (!amenities) return null;

    const total =
      amenities.pharmacies +
      amenities.doctors +
      amenities.schools +
      amenities.gyms +
      amenities.cinemas;
    if (!Number.isFinite(total) || row.area_km2 <= 0) {
      return null;
    }

    return total / row.area_km2;
  }
  if (dimension === "culture") {
    return row.dimensions.culture?.cultural_buildings_per_km2 ?? null;
  }

  return null;
}

function shouldInvertScore(dimension: DataDimension): boolean {
  return (
    dimension === "housing" || dimension === "safety" || dimension === "noise"
  );
}

function normalizeEnabledDimensionScores(rows: ArrondissementRow[]): void {
  for (const dimension of DATA_CONFIG.enabledDimensions) {
    const rawValues = rows
      .map((row) => getRawMetricForDimension(row, dimension))
      .filter(
        (value): value is number => value != null && Number.isFinite(value),
      );

    if (rawValues.length === 0) {
      continue;
    }

    const min = Math.min(...rawValues);
    const max = Math.max(...rawValues);
    const invert = shouldInvertScore(dimension);

    for (const row of rows) {
      const raw = getRawMetricForDimension(row, dimension);
      if (raw == null || !Number.isFinite(raw)) {
        row.scores[dimension] = null;
        continue;
      }

      if (max === min) {
        row.scores[dimension] = 50;
        continue;
      }

      let score = ((raw - min) / (max - min)) * 100;
      if (invert) {
        score = 100 - score;
      }
      row.scores[dimension] = round(score, 2);
    }
  }
}

function validateNoNegative(
  value: unknown,
  pathLabel: string,
  errors: string[],
): void {
  if (pathLabel.endsWith(".yoy_change")) {
    return;
  }

  if (typeof value === "number") {
    if (value < 0) errors.push(`negative value at ${pathLabel}: ${value}`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateNoNegative(item, `${pathLabel}[${index}]`, errors),
    );
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      validateNoNegative(nested, `${pathLabel}.${key}`, errors);
    }
  }
}

function evaluateQuality(
  rows: ArrondissementRow[],
  baseWarnings: string[],
): BuildQuality {
  const hardFailErrors: string[] = [];
  const warnings: string[] = [...baseWarnings];
  const coverage = Object.fromEntries(
    DIMENSION_KEYS.map((key) => [key, 0]),
  ) as Record<DataDimension, number>;

  const expectedCodes = new Set<string>(PARIS_ARRONDISSEMENT_COMMUNES);
  const seenCodes = new Set<string>();

  if (rows.length !== PARIS_ARRONDISSEMENT_COMMUNES.length) {
    hardFailErrors.push(
      `expected ${PARIS_ARRONDISSEMENT_COMMUNES.length} rows, found ${rows.length}`,
    );
  }

  for (const row of rows) {
    if (seenCodes.has(row.code)) {
      hardFailErrors.push(`duplicate arrondissement code: ${row.code}`);
    }
    seenCodes.add(row.code);

    if (!expectedCodes.has(row.code)) {
      hardFailErrors.push(`unexpected arrondissement code: ${row.code}`);
    }

    if (
      !row.code ||
      !Number.isFinite(row.number) ||
      row.name.trim().length === 0 ||
      !Number.isFinite(row.population) ||
      !Number.isFinite(row.area_km2)
    ) {
      hardFailErrors.push(`missing required base field(s) for ${row.code}`);
    }

    if (row.population <= 0) {
      hardFailErrors.push(
        `invalid population for ${row.code}: ${row.population}`,
      );
    }

    if (row.area_km2 <= 0) {
      hardFailErrors.push(`invalid area_km2 for ${row.code}: ${row.area_km2}`);
    }

    validateNoNegative(
      row.population,
      `${row.code}.population`,
      hardFailErrors,
    );
    validateNoNegative(row.area_km2, `${row.code}.area_km2`, hardFailErrors);

    for (const key of DIMENSION_KEYS) {
      const value = row.dimensions[key];
      if (value != null) {
        coverage[key] += 1;
        validateNoNegative(
          value,
          `${row.code}.dimensions.${key}`,
          hardFailErrors,
        );
      }
    }
  }

  for (const code of PARIS_ARRONDISSEMENT_COMMUNES) {
    if (!seenCodes.has(code)) {
      hardFailErrors.push(`missing arrondissement row: ${code}`);
    }
  }

  for (const key of DATA_CONFIG.enabledDimensions) {
    const count = coverage[key];
    if (count < 18) {
      hardFailErrors.push(
        `coverage too low for enabled dimension "${key}": ${count}/20`,
      );
      continue;
    }
    if (count < 20) {
      warnings.push(`partial coverage for "${key}": ${count}/20`);
    }
  }

  return {
    hard_fail_checks_passed: hardFailErrors.length === 0,
    hard_fail_errors: hardFailErrors,
    warnings,
    coverage_by_dimension: coverage,
  };
}

function enrichBoundaries(
  boundaries: BoundaryCollection,
  rows: ArrondissementRow[],
): BoundaryCollection {
  const rowByCode = new Map(rows.map((row) => [row.code, row] as const));

  return {
    ...boundaries,
    features: boundaries.features.map((feature) => {
      const props = feature.properties ?? {};
      const rawCode = props.c_arinsee;
      if (rawCode == null) return feature;

      const code = assertParisCode(rawCode);
      const row = rowByCode.get(code);
      if (!row) return feature;

      return {
        ...feature,
        properties: {
          ...props,
          code: row.code,
          number: row.number,
          name: row.name,
          area_km2: row.area_km2,
          score_housing: row.scores.housing,
          score_income: row.scores.income,
          score_safety: row.scores.safety,
          score_transport: row.scores.transport,
          score_nightlife: row.scores.nightlife,
          score_greenSpace: row.scores.greenSpace,
          score_noise: row.scores.noise,
          score_amenities: row.scores.amenities,
          score_culture: row.scores.culture,
        },
      };
    }),
  };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const mode = options.offline ? "cache-only" : "network-first";
  await validateBuildPreconditions(mode);
  const generatedAt = new Date().toISOString();
  const driftBaseline = await loadDriftBaseline();

  const boundariesRaw = await readFile(BOUNDARIES_PATH, "utf8");
  const boundaries = JSON.parse(boundariesRaw) as BoundaryCollection;
  if (!Array.isArray(boundaries.features)) {
    throw new Error("invalid boundaries file: missing features");
  }
  const sharedIncomePopulation = await loadIncomePopulationFromFilosofi({
    mode,
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    config: DATA_CONFIG.sources.filosofi,
  });

  const rows = buildRows(
    boundaries,
    sharedIncomePopulation.populationByCommune,
  );
  applyIncomeDimension(rows, sharedIncomePopulation.incomeByCommune);
  const sourceRowCounts: Record<string, number> = {
    boundaries: boundaries.features.length,
    ...sharedIncomePopulation.sourceRowCounts,
  };
  const sourceChecksums: Record<string, string> = {
    boundaries: sha256(boundariesRaw),
    ...sharedIncomePopulation.sourceChecksums,
  };
  const sourceUrls: Record<string, string> = { ...DATA_CONFIG.sourceUrls };
  Object.assign(sourceUrls, sharedIncomePopulation.sourceUrls);
  const warnings: string[] = [...sharedIncomePopulation.warnings];
  warnings.push(...driftBaseline.warnings);

  const housingContribution = await applyHousingDimension(rows, mode);
  Object.assign(sourceRowCounts, housingContribution.sourceRowCounts);
  Object.assign(sourceChecksums, housingContribution.sourceChecksums);
  Object.assign(sourceUrls, housingContribution.sourceUrls);
  warnings.push(...housingContribution.warnings);

  const safetyContribution = await applySafetyDimension(rows, mode);
  Object.assign(sourceRowCounts, safetyContribution.sourceRowCounts);
  Object.assign(sourceChecksums, safetyContribution.sourceChecksums);
  Object.assign(sourceUrls, safetyContribution.sourceUrls);
  warnings.push(...safetyContribution.warnings);

  const transportContribution = await applyTransportDimension(
    rows,
    boundaries,
    mode,
  );
  Object.assign(sourceRowCounts, transportContribution.sourceRowCounts);
  Object.assign(sourceChecksums, transportContribution.sourceChecksums);
  Object.assign(sourceUrls, transportContribution.sourceUrls);
  warnings.push(...transportContribution.warnings);

  const nightlifeContribution = await applyNightlifeDimension(rows, mode);
  Object.assign(sourceRowCounts, nightlifeContribution.sourceRowCounts);
  Object.assign(sourceChecksums, nightlifeContribution.sourceChecksums);
  Object.assign(sourceUrls, nightlifeContribution.sourceUrls);
  warnings.push(...nightlifeContribution.warnings);

  const greenSpaceContribution = await applyGreenSpaceDimension(
    rows,
    boundaries,
    mode,
  );
  Object.assign(sourceRowCounts, greenSpaceContribution.sourceRowCounts);
  Object.assign(sourceChecksums, greenSpaceContribution.sourceChecksums);
  Object.assign(sourceUrls, greenSpaceContribution.sourceUrls);
  warnings.push(...greenSpaceContribution.warnings);

  const noiseContribution = await applyNoiseDimension(rows, mode);
  Object.assign(sourceRowCounts, noiseContribution.sourceRowCounts);
  Object.assign(sourceChecksums, noiseContribution.sourceChecksums);
  Object.assign(sourceUrls, noiseContribution.sourceUrls);
  warnings.push(...noiseContribution.warnings);

  const amenitiesContribution = await applyAmenitiesDimension(rows, mode);
  Object.assign(sourceRowCounts, amenitiesContribution.sourceRowCounts);
  Object.assign(sourceChecksums, amenitiesContribution.sourceChecksums);
  Object.assign(sourceUrls, amenitiesContribution.sourceUrls);
  warnings.push(...amenitiesContribution.warnings);

  warnings.push(
    ...collectRowCountDriftWarnings(sourceRowCounts, driftBaseline.metadata),
  );
  warnings.push(...collectMetricDriftWarnings(rows, driftBaseline.rows));

  normalizeEnabledDimensionScores(rows);
  const quality = evaluateQuality(rows, warnings);

  const metadata: DataMetadata = {
    generated_at: generatedAt,
    enabled_dimensions: [...DATA_CONFIG.enabledDimensions],
    source_vintages: DATA_CONFIG.sourceVintages,
    source_urls: sourceUrls,
    source_row_counts: sourceRowCounts,
    source_checksums: sourceChecksums,
    quality,
  };

  await writeFile(ARRONDISSEMENTS_PATH, JSON.stringify(rows, null, 2));
  await writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2));

  const enrichedBoundaries = enrichBoundaries(boundaries, rows);
  await writeFile(BOUNDARIES_PATH, JSON.stringify(enrichedBoundaries, null, 2));

  if (!quality.hard_fail_checks_passed) {
    throw new Error(
      `data quality hard-fail checks failed:\n${quality.hard_fail_errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }

  console.log(`wrote ${ARRONDISSEMENTS_PATH}`);
  console.log(`wrote ${METADATA_PATH}`);
  console.log(`updated ${BOUNDARIES_PATH}`);
  console.log(`warnings: ${quality.warnings.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
