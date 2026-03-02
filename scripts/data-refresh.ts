import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DATA_CONFIG,
  PARIS_ARRONDISSEMENT_COMMUNES,
  getEnabledSireneBuckets,
} from "./data-config";
import { buildAmenitiesFromBpe } from "./sources/amenities";
import {
  buildCultureFromBasilic,
  type CultureByType,
} from "./sources/culture-basilic";
import { fetchSireneNightlifeSnapshot } from "./sources/sirene";

type RefreshOptions = {
  dimensions: string[];
  commune: string | null;
  all: boolean;
  offline: boolean;
  outPath: string;
};

function logInfo(message: string): void {
  console.log(`[data:refresh] ${message}`);
}

function logWarn(message: string): void {
  console.warn(`[data:refresh][warn] ${message}`);
}

function logError(message: string): void {
  console.error(`[data:refresh][error] ${message}`);
}

function parseOptions(argv: string[]): RefreshOptions {
  let dimensions: string[] = [];
  let commune: string | null = null;
  let all = false;
  let offline = false;
  let outPath = path.join(
    process.cwd(),
    "data",
    "raw",
    "sirene",
    "nightlife-snapshots.json",
  );

  for (const arg of argv) {
    if (arg.startsWith("--dimensions=")) {
      dimensions = arg
        .slice("--dimensions=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    if (arg.startsWith("--commune=")) {
      commune = arg.slice("--commune=".length);
      continue;
    }

    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg === "--offline") {
      offline = true;
      continue;
    }

    if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
      continue;
    }
  }

  return { dimensions, commune, all, offline, outPath };
}

function resolveDimensions(input: string[]): Set<string> {
  if (input.length > 0) return new Set(input);
  return new Set(DATA_CONFIG.enabledDimensions);
}

function resolveCommunes(options: RefreshOptions): string[] {
  if (options.commune) return [options.commune];
  if (options.all) return [...PARIS_ARRONDISSEMENT_COMMUNES];
  return ["75111"];
}

async function refreshNightlife(options: RefreshOptions): Promise<void> {
  const communes = resolveCommunes(options);
  const buckets = getEnabledSireneBuckets();
  const mode = options.offline ? "cache-only" : "network-first";
  const accessToken = process.env.SIRENE_API_TOKEN ?? "";
  logInfo(
    `nightlife refresh start (mode=${mode}, communes=${communes.length}, source=${DATA_CONFIG.sources.sirene.baseUrl})`,
  );
  logInfo(`nightlife buckets: ${buckets.join(", ")}`);

  if (mode === "network-first" && accessToken.length === 0) {
    throw new Error(
      "SIRENE_API_TOKEN is required for online nightlife refresh",
    );
  }

  const snapshots = [];
  for (const communeCode of communes) {
    logInfo(`nightlife fetch commune=${communeCode}`);
    const snapshot = await fetchSireneNightlifeSnapshot({
      communeCode,
      accessToken,
      buckets,
      mode,
      expectedNomenclatures: DATA_CONFIG.sources.sirene.expectedNomenclatures,
    });
    logInfo(
      `nightlife fetched commune=${communeCode} pages=${snapshot.stats.pageCount} processed=${snapshot.stats.processedEtablissements} matched=${snapshot.stats.matchedByApeCount} unmatched=${snapshot.stats.unmatchedApeCount}`,
    );
    snapshots.push(snapshot);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    mode,
    dimensions: ["nightlife"],
    communes,
    buckets,
    expectedNomenclatures: DATA_CONFIG.sources.sirene.expectedNomenclatures,
    snapshots,
  };

  await mkdir(path.dirname(options.outPath), { recursive: true });
  await writeFile(options.outPath, JSON.stringify(payload, null, 2));
  logInfo(`wrote nightlife snapshots: ${options.outPath}`);
}

async function refreshBpe(options: RefreshOptions): Promise<void> {
  const mode = options.offline ? "cache-only" : "network-first";
  logInfo(
    `bpe refresh start (mode=${mode}, source=${DATA_CONFIG.sources.bpe.sourceUrl}, cache=${DATA_CONFIG.sources.bpe.cachePath})`,
  );
  const refreshed = await buildAmenitiesFromBpe({
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    mode,
    config: DATA_CONFIG.sources.bpe,
  });

  logInfo(`refreshed bpe cache: ${DATA_CONFIG.sources.bpe.cachePath}`);
  logInfo(
    `bpe rows total=${refreshed.sourceRowCounts.bpe_rows_total ?? 0} matched=${refreshed.sourceRowCounts.bpe_rows_matched ?? 0}`,
  );
  for (const warning of refreshed.warnings) {
    logWarn(warning);
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function refreshCulture(options: RefreshOptions): Promise<void> {
  const mode = options.offline ? "cache-only" : "network-first";
  logInfo(
    `culture refresh start (mode=${mode}, source=${DATA_CONFIG.sources.culture.sourceUrl}, cache=${DATA_CONFIG.sources.culture.cachePath})`,
  );

  const refreshed = await buildCultureFromBasilic({
    communes: PARIS_ARRONDISSEMENT_COMMUNES,
    mode,
    config: DATA_CONFIG.sources.culture,
  });

  const cityTotals: CultureByType = {
    cinemas: 0,
    libraries: 0,
    heritage: 0,
    livePerformanceVenues: 0,
    archives: 0,
    museums: 0,
  };
  for (const byType of refreshed.byCommune.values()) {
    cityTotals.cinemas = round(cityTotals.cinemas + byType.cinemas, 2);
    cityTotals.libraries = round(cityTotals.libraries + byType.libraries, 2);
    cityTotals.heritage = round(cityTotals.heritage + byType.heritage, 2);
    cityTotals.livePerformanceVenues = round(
      cityTotals.livePerformanceVenues + byType.livePerformanceVenues,
      2,
    );
    cityTotals.archives = round(cityTotals.archives + byType.archives, 2);
    cityTotals.museums = round(cityTotals.museums + byType.museums, 2);
  }

  logInfo(`refreshed culture cache: ${DATA_CONFIG.sources.culture.cachePath}`);
  logInfo(
    `culture rows total=${refreshed.sourceRowCounts.culture_rows_total ?? 0} matched=${refreshed.sourceRowCounts.culture_rows_matched ?? 0} deduplicated=${refreshed.sourceRowCounts.culture_rows_deduplicated ?? 0} unmapped=${refreshed.sourceRowCounts.culture_rows_unmapped_type ?? 0}`,
  );
  logInfo(`culture totals by type: ${JSON.stringify(cityTotals)}`);
  for (const warning of refreshed.warnings) {
    logWarn(warning);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const dimensions = resolveDimensions(options.dimensions);
  logInfo(
    `starting refresh (mode=${options.offline ? "cache-only" : "network-first"}, requestedDimensions=${options.dimensions.length > 0 ? options.dimensions.join(", ") : "from enabledDimensions"})`,
  );
  const shouldRefreshNightlife = dimensions.has("nightlife");
  const shouldRefreshBpe = dimensions.has("amenities") || dimensions.has("bpe");
  const shouldRefreshCulture = dimensions.has("culture");

  if (!shouldRefreshNightlife && !shouldRefreshBpe && !shouldRefreshCulture) {
    logInfo(
      "nothing to do: supported refresh dimensions are nightlife, amenities, culture",
    );
    return;
  }

  if (shouldRefreshNightlife) {
    await refreshNightlife(options);
  }

  if (shouldRefreshBpe) {
    await refreshBpe(options);
  }

  if (shouldRefreshCulture) {
    await refreshCulture(options);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logError(message);
  if (error instanceof Error && error.stack) {
    logError(error.stack);
  }
  process.exit(1);
});
