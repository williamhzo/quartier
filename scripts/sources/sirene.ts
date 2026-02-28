import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_CONFIG } from "../data-config";
import { type SireneNightlifeBucket, SIRENE_NAF_BUCKETS } from "./sirene-naf";
import { buildSireneNightlifeSearchParams } from "./sirene-query";
import { assertValidSireneNafBuckets } from "./validate-sirene-naf";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 200;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 500;

type SireneFetchMode = "network-first" | "cache-only";

type SirenePageHeader = {
  total?: number;
  debut?: number;
  nombre?: number;
  statut?: number;
  message?: string;
};

type SirenePeriod = {
  activitePrincipaleEtablissement?: string;
  nomenclatureActivitePrincipaleEtablissement?: string;
  etatAdministratifEtablissement?: string;
};

type SireneEtablissement = {
  activitePrincipaleEtablissement?: string;
  nomenclatureActivitePrincipaleEtablissement?: string;
  periodesEtablissement?: SirenePeriod[];
};

type SirenePageResponse = {
  header?: SirenePageHeader;
  etablissements?: SireneEtablissement[];
};

type CachedSirenePage = {
  request: {
    url: string;
    fetchedAt: string;
  };
  response: SirenePageResponse;
};

export type FetchSireneNightlifeOptions = {
  communeCode: string;
  accessToken: string;
  buckets: readonly SireneNightlifeBucket[];
  expectedNomenclatures?: readonly string[];
  cacheDir?: string;
  mode?: SireneFetchMode;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
  maxRetries?: number;
  initialRetryDelayMs?: number;
};

export type NightlifeBucketCounts = Record<SireneNightlifeBucket, number>;

export type NightlifeMetric = {
  restaurants_per_km2: number;
  bars_per_km2: number;
  cafes_per_km2: number;
};

export type SireneNightlifeSnapshot = {
  communeCode: string;
  fetchedAt: string;
  source: {
    apiVersion: string;
    baseUrl: string;
    query: string;
  };
  stats: {
    requestedBucketCount: number;
    pageCount: number;
    apiReportedTotal: number;
    processedEtablissements: number;
    matchedByApeCount: number;
    unmatchedApeCount: number;
  };
  buckets: NightlifeBucketCounts;
  nomenclaturesEncountered: string[];
};

export type BuildNightlifeFromSireneOutput = {
  byCommune: Map<string, NightlifeMetric>;
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitter(max: number): number {
  return Math.floor(Math.random() * max);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizePageResponse(input: unknown): SirenePageResponse {
  if (!input || typeof input !== "object") return {};
  return input as SirenePageResponse;
}

function getCacheRootPath(customCacheDir?: string): string {
  return customCacheDir ?? path.join(process.cwd(), "data", "raw", "sirene");
}

export function buildSireneNightlifeQueryHash(query: string): string {
  return createHash("sha256").update(query).digest("hex").slice(0, 12);
}

export function buildSireneNightlifeCachePagePath(options: {
  communeCode: string;
  query: string;
  pageOffset: number;
  cacheDir?: string;
}): string {
  const cacheRoot = getCacheRootPath(options.cacheDir);
  const queryHash = buildSireneNightlifeQueryHash(options.query);

  return path.join(
    cacheRoot,
    options.communeCode,
    queryHash,
    `page-${String(options.pageOffset).padStart(5, "0")}.json`,
  );
}

function getApeAndNomenclature(etablissement: SireneEtablissement): {
  ape: string | null;
  nomenclature: string | null;
} {
  if (etablissement.activitePrincipaleEtablissement) {
    return {
      ape: etablissement.activitePrincipaleEtablissement,
      nomenclature:
        etablissement.nomenclatureActivitePrincipaleEtablissement ?? null,
    };
  }

  const periods = etablissement.periodesEtablissement ?? [];
  const activePeriod =
    periods.find(
      (period) =>
        period.etatAdministratifEtablissement === "A" &&
        period.activitePrincipaleEtablissement,
    ) ??
    periods.find((period) => Boolean(period.activitePrincipaleEtablissement));

  if (!activePeriod?.activitePrincipaleEtablissement) {
    return { ape: null, nomenclature: null };
  }

  return {
    ape: activePeriod.activitePrincipaleEtablissement,
    nomenclature:
      activePeriod.nomenclatureActivitePrincipaleEtablissement ?? null,
  };
}

function buildBucketCodeMap(
  buckets: readonly SireneNightlifeBucket[],
): Map<string, SireneNightlifeBucket> {
  const map = new Map<string, SireneNightlifeBucket>();

  for (const bucket of buckets) {
    for (const code of SIRENE_NAF_BUCKETS[bucket].codes) {
      map.set(code, bucket);
    }
  }

  return map;
}

function createZeroBucketCounts(): NightlifeBucketCounts {
  return {
    restaurants: 0,
    bars_cafes: 0,
    nightlife_extension: 0,
  };
}

export function assertExpectedNomenclatures(
  encountered: readonly string[],
  expected: readonly string[],
): void {
  if (expected.length === 0) return;

  const expectedSet = new Set(expected);
  const unexpected = encountered.filter((item) => !expectedSet.has(item));

  if (unexpected.length > 0) {
    throw new Error(
      `sirene nomenclature mismatch: expected one of [${expected.join(
        ", ",
      )}], received [${unexpected.join(", ")}]`,
    );
  }
}

async function fetchSirenePageFromApi(
  url: string,
  accessToken: string,
  timeoutMs: number,
  maxRetries: number,
  initialRetryDelayMs: number,
): Promise<SirenePageResponse> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < maxRetries
      ) {
        const delay =
          initialRetryDelayMs * 2 ** attempt +
          randomJitter(initialRetryDelayMs);
        await sleep(delay);
        attempt += 1;
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `sirene request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      return normalizePageResponse(await response.json());
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      const delay =
        initialRetryDelayMs * 2 ** attempt + randomJitter(initialRetryDelayMs);
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function getSirenePage(
  url: string,
  cachePath: string,
  mode: SireneFetchMode,
  accessToken: string,
  timeoutMs: number,
  maxRetries: number,
  initialRetryDelayMs: number,
): Promise<SirenePageResponse> {
  try {
    const cached = await readFile(cachePath, "utf8");
    const parsed = JSON.parse(cached) as CachedSirenePage;
    return normalizePageResponse(parsed.response);
  } catch {
    if (mode === "cache-only") {
      throw new Error(`missing cache file in cache-only mode: ${cachePath}`);
    }
  }

  const response = await fetchSirenePageFromApi(
    url,
    accessToken,
    timeoutMs,
    maxRetries,
    initialRetryDelayMs,
  );

  await mkdir(path.dirname(cachePath), { recursive: true });
  const payload: CachedSirenePage = {
    request: { url, fetchedAt: new Date().toISOString() },
    response,
  };
  await writeFile(cachePath, JSON.stringify(payload, null, 2));

  return response;
}

export function aggregateNightlifeFromEtablissements(
  etablissements: readonly SireneEtablissement[],
  buckets: readonly SireneNightlifeBucket[],
): {
  bucketCounts: NightlifeBucketCounts;
  matchedByApeCount: number;
  unmatchedApeCount: number;
  nomenclaturesEncountered: string[];
} {
  const bucketCounts = createZeroBucketCounts();
  const bucketCodeMap = buildBucketCodeMap(buckets);
  const nomenclatures = new Set<string>();
  let matchedByApeCount = 0;
  let unmatchedApeCount = 0;

  for (const etablissement of etablissements) {
    const { ape, nomenclature } = getApeAndNomenclature(etablissement);

    if (nomenclature) {
      nomenclatures.add(nomenclature);
    }

    if (!ape) {
      unmatchedApeCount += 1;
      continue;
    }

    const bucket = bucketCodeMap.get(ape);
    if (!bucket) {
      unmatchedApeCount += 1;
      continue;
    }

    bucketCounts[bucket] += 1;
    matchedByApeCount += 1;
  }

  return {
    bucketCounts,
    matchedByApeCount,
    unmatchedApeCount,
    nomenclaturesEncountered: [...nomenclatures].sort(),
  };
}

export async function fetchSireneNightlifeSnapshot(
  options: FetchSireneNightlifeOptions,
): Promise<SireneNightlifeSnapshot> {
  assertValidSireneNafBuckets();

  const mode = options.mode ?? "network-first";
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialRetryDelayMs =
    options.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
  const cacheRoot = getCacheRootPath(options.cacheDir);

  const baseParams = buildSireneNightlifeSearchParams(
    options.communeCode,
    options.buckets,
  );
  const query = baseParams.get("q");
  if (!query) throw new Error("missing sirene query");

  let pageOffset = 0;
  let pageCount = 0;
  let apiReportedTotal = 0;
  const allEtablissements: SireneEtablissement[] = [];

  while (pageCount < maxPages) {
    const pageParams = new URLSearchParams(baseParams);
    pageParams.set("debut", String(pageOffset));
    pageParams.set("nombre", String(pageSize));

    const url = `${DATA_CONFIG.sources.sirene.baseUrl}?${pageParams.toString()}`;
    const cachePath = buildSireneNightlifeCachePagePath({
      cacheDir: cacheRoot,
      communeCode: options.communeCode,
      query,
      pageOffset,
    });
    const page = await getSirenePage(
      url,
      cachePath,
      mode,
      options.accessToken,
      timeoutMs,
      maxRetries,
      initialRetryDelayMs,
    );

    const pageHeader = page.header ?? {};
    const etablissements = page.etablissements ?? [];
    const total = pageHeader.total ?? apiReportedTotal;
    const pageSizeFromHeader = pageHeader.nombre ?? etablissements.length;

    apiReportedTotal = total;
    allEtablissements.push(...etablissements);
    pageCount += 1;

    if (etablissements.length === 0) break;
    if (pageOffset + pageSizeFromHeader >= total) break;

    pageOffset += pageSizeFromHeader;
  }

  if (pageCount >= maxPages && allEtablissements.length < apiReportedTotal) {
    throw new Error(
      `sirene pagination exceeded maxPages=${maxPages} for ${options.communeCode}`,
    );
  }

  const aggregate = aggregateNightlifeFromEtablissements(
    allEtablissements,
    options.buckets,
  );

  assertExpectedNomenclatures(
    aggregate.nomenclaturesEncountered,
    options.expectedNomenclatures ?? [],
  );

  return {
    communeCode: options.communeCode,
    fetchedAt: new Date().toISOString(),
    source: {
      apiVersion: DATA_CONFIG.sources.sirene.apiVersion,
      baseUrl: DATA_CONFIG.sources.sirene.baseUrl,
      query,
    },
    stats: {
      requestedBucketCount: options.buckets.length,
      pageCount,
      apiReportedTotal,
      processedEtablissements: allEtablissements.length,
      matchedByApeCount: aggregate.matchedByApeCount,
      unmatchedApeCount: aggregate.unmatchedApeCount,
    },
    buckets: aggregate.bucketCounts,
    nomenclaturesEncountered: aggregate.nomenclaturesEncountered,
  };
}

export async function buildNightlifeFromSirene(options: {
  communes: readonly string[];
  areaByCommune: Map<string, number>;
  buckets: readonly SireneNightlifeBucket[];
  mode: SireneFetchMode;
  accessToken: string;
  expectedNomenclatures?: readonly string[];
}): Promise<BuildNightlifeFromSireneOutput> {
  if (options.mode === "network-first" && options.accessToken.length === 0) {
    throw new Error(
      "SIRENE_API_TOKEN is required when building nightlife in network mode",
    );
  }

  const byCommune = new Map<string, NightlifeMetric>();
  const snapshots: SireneNightlifeSnapshot[] = [];
  const warnings: string[] = [];
  let processedRows = 0;
  let matchedRows = 0;
  let unmatchedRows = 0;
  let fetchedPages = 0;

  for (const communeCode of options.communes) {
    const areaKm2 = options.areaByCommune.get(communeCode);
    if (!areaKm2 || !Number.isFinite(areaKm2) || areaKm2 <= 0) {
      throw new Error(
        `missing or invalid area for nightlife metric: ${communeCode}`,
      );
    }

    const snapshot = await fetchSireneNightlifeSnapshot({
      communeCode,
      accessToken: options.accessToken,
      buckets: options.buckets,
      mode: options.mode,
      expectedNomenclatures: options.expectedNomenclatures,
    });

    snapshots.push(snapshot);
    processedRows += snapshot.stats.processedEtablissements;
    matchedRows += snapshot.stats.matchedByApeCount;
    unmatchedRows += snapshot.stats.unmatchedApeCount;
    fetchedPages += snapshot.stats.pageCount;

    const restaurantsDensity = round(snapshot.buckets.restaurants / areaKm2, 2);
    const barsCafesDensity = round(snapshot.buckets.bars_cafes / areaKm2, 2);
    byCommune.set(communeCode, {
      restaurants_per_km2: restaurantsDensity,
      bars_per_km2: barsCafesDensity,
      cafes_per_km2: barsCafesDensity,
    });
  }

  if (options.buckets.includes("nightlife_extension")) {
    warnings.push(
      "nightlife_extension bucket is fetched but excluded from v1 nightlife density fields",
    );
  }

  warnings.push(
    "cafes_per_km2 mirrors bars_per_km2 because SIRENE v1 buckets bars and cafes together under NAF 56.30Z",
  );

  return {
    byCommune,
    sourceRowCounts: {
      sirene_rows_processed: processedRows,
      sirene_rows_matched: matchedRows,
      sirene_rows_unmatched: unmatchedRows,
      sirene_pages_fetched: fetchedPages,
    },
    sourceChecksums: {
      sirene_snapshot_aggregate: createHash("sha256")
        .update(JSON.stringify(snapshots))
        .digest("hex"),
    },
    sourceUrls: {
      sirene: DATA_CONFIG.sources.sirene.baseUrl,
    },
    warnings,
  };
}
