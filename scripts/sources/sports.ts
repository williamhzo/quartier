import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

type SportsFetchMode = "network-first" | "cache-only";

type SportsBucket =
  | "fitness"
  | "tennis"
  | "swimming"
  | "multisport"
  | "combat"
  | "athletics"
  | "team_sports";

type DataEsSportsConfig = {
  apiBaseUrl: string;
  sourceUrl: string;
  cachePath: string;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
  maxRecords: number;
  departmentCode: string;
  bucketMapping: Record<SportsBucket, string[]>;
};

export type SportsMetric = {
  facilities_total: number;
  facilities_per_km2: number;
  facilities_per_10k_residents: number;
  by_type: Record<SportsBucket, number>;
};

export type BuildSportsFromDataEsOutput = {
  byCommune: Map<string, SportsMetric>;
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

type AggregatedSportsRow = {
  new_code?: unknown;
  equip_type_famille?: unknown;
  count?: unknown;
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

function getCachePath(cachePath: string): string {
  return path.join(process.cwd(), cachePath);
}

function getQueryMarkerPath(cachePath: string): string {
  return `${cachePath}.query`;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function encodeQuotedList(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(",");
}

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildBucketByFamily(
  mapping: DataEsSportsConfig["bucketMapping"],
): Map<string, SportsBucket> {
  const bucketByFamily = new Map<string, SportsBucket>();
  for (const [bucket, families] of Object.entries(mapping) as Array<
    [SportsBucket, string[]]
  >) {
    for (const family of families) {
      bucketByFamily.set(normalizeLabel(family), bucket);
    }
  }
  return bucketByFamily;
}

function createZeroByType(): SportsMetric["by_type"] {
  return {
    fitness: 0,
    tennis: 0,
    swimming: 0,
    multisport: 0,
    combat: 0,
    athletics: 0,
    team_sports: 0,
  };
}

function buildDataEsQueryUrl(
  communes: readonly string[],
  config: DataEsSportsConfig,
): string {
  const where = `dep_code='${config.departmentCode}' and new_code in (${encodeQuotedList(communes)})`;
  const params = new URLSearchParams({
    select: "new_code,equip_type_famille,count(*) as count",
    group_by: "new_code,equip_type_famille",
    where,
    limit: String(config.maxRecords),
  });
  return `${config.apiBaseUrl}?${params.toString()}`;
}

async function fetchResponseToCache(
  fetchUrl: string,
  config: DataEsSportsConfig,
  cachePath: string,
): Promise<void> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < config.maxRetries
      ) {
        const delay =
          config.initialRetryDelayMs * 2 ** attempt +
          randomJitter(config.initialRetryDelayMs);
        await sleep(delay);
        attempt += 1;
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `sports request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("sports response has no body");
      }

      const tempPath = `${cachePath}.tmp-${Date.now()}`;
      await mkdir(path.dirname(cachePath), { recursive: true });
      const responseBody = response.body as unknown as NodeReadableStream<
        Uint8Array
      >;
      await pipeline(
        Readable.fromWeb(responseBody),
        createWriteStream(tempPath),
      );
      await rename(tempPath, cachePath);
      await writeFile(getQueryMarkerPath(cachePath), fetchUrl);
      return;
    } catch (error) {
      if (attempt >= config.maxRetries) throw error;
      const delay =
        config.initialRetryDelayMs * 2 ** attempt +
        randomJitter(config.initialRetryDelayMs);
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function ensureResponsePath(
  mode: SportsFetchMode,
  fetchUrl: string,
  config: DataEsSportsConfig,
): Promise<{
  responsePath: string;
  usedLegacyCacheWithoutQueryMarker: boolean;
}> {
  const cachePath = getCachePath(config.cachePath);
  const queryMarkerPath = getQueryMarkerPath(cachePath);

  try {
    await readFile(cachePath, "utf8");
    try {
      const cachedQuery = (await readFile(queryMarkerPath, "utf8")).trim();
      if (cachedQuery === fetchUrl) {
        return {
          responsePath: cachePath,
          usedLegacyCacheWithoutQueryMarker: false,
        };
      }

      if (mode === "cache-only") {
        throw new Error(
          `stale sports cache in --offline mode: query changed. expected ${fetchUrl}`,
        );
      }

      await fetchResponseToCache(fetchUrl, config, cachePath);
      return {
        responsePath: cachePath,
        usedLegacyCacheWithoutQueryMarker: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string }).code;
      if (code === "ENOENT") {
        if (mode === "cache-only") {
          return {
            responsePath: cachePath,
            usedLegacyCacheWithoutQueryMarker: true,
          };
        }

        await fetchResponseToCache(fetchUrl, config, cachePath);
        return {
          responsePath: cachePath,
          usedLegacyCacheWithoutQueryMarker: false,
        };
      }

      if (
        mode === "cache-only" &&
        message.startsWith("stale sports cache in --offline mode")
      ) {
        throw new Error(message);
      }

      if (mode !== "cache-only") {
        await fetchResponseToCache(fetchUrl, config, cachePath);
        return {
          responsePath: cachePath,
          usedLegacyCacheWithoutQueryMarker: false,
        };
      }

      throw error;
    }
  } catch (error) {
    if (mode === "cache-only") {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("stale sports cache in --offline mode")) {
        throw new Error(message);
      }
      throw new Error(
        `missing sports cache in --offline mode: ${cachePath}. (${message})`,
      );
    }
  }

  await fetchResponseToCache(fetchUrl, config, cachePath);
  return {
    responsePath: cachePath,
    usedLegacyCacheWithoutQueryMarker: false,
  };
}

function readStringField(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "string" &&
    value[0].trim().length > 0
  ) {
    return value[0].trim();
  }
  return null;
}

function readNumberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function buildSportsFromDataEs(options: {
  communes: readonly string[];
  areaByCommune: Map<string, number>;
  populationByCommune: Map<string, number>;
  mode: SportsFetchMode;
  config: DataEsSportsConfig;
}): Promise<BuildSportsFromDataEsOutput> {
  const fetchUrl = buildDataEsQueryUrl(options.communes, options.config);
  const response = await ensureResponsePath(options.mode, fetchUrl, options.config);
  const raw = await readFile(response.responsePath, "utf8");

  const parsed = JSON.parse(raw) as {
    total_count?: unknown;
    results?: unknown;
  };
  if (!Array.isArray(parsed.results)) {
    throw new Error("invalid sports response payload: missing results array");
  }

  const totalCount = readNumberField(parsed.total_count);
  if (
    totalCount != null &&
    Number.isFinite(totalCount) &&
    totalCount > options.config.maxRecords
  ) {
    throw new Error(
      `sports response truncated: total_count ${totalCount} exceeds configured limit ${options.config.maxRecords}`,
    );
  }

  const warnings: string[] = [];
  if (response.usedLegacyCacheWithoutQueryMarker) {
    warnings.push(
      `sports cache query marker missing (${getQueryMarkerPath(options.config.cachePath)}); accepted legacy cache in --offline mode. Refresh online with: bun run data:build`,
    );
  }

  const communeSet = new Set(options.communes);
  const bucketByFamily = buildBucketByFamily(options.config.bucketMapping);
  const byTypeByCommune = new Map<string, SportsMetric["by_type"]>();
  for (const communeCode of options.communes) {
    byTypeByCommune.set(communeCode, createZeroByType());
  }

  let matchedRows = 0;
  let skippedRows = 0;
  let unmappedRows = 0;
  let unmappedFacilities = 0;
  const unmappedFamilies = new Map<string, number>();

  for (const row of parsed.results as AggregatedSportsRow[]) {
    const communeCode = readStringField(row.new_code);
    const familyLabel = readStringField(row.equip_type_famille);
    const count = readNumberField(row.count);
    if (!communeCode || !familyLabel || count == null || count < 0) {
      skippedRows += 1;
      continue;
    }

    if (!communeSet.has(communeCode)) {
      continue;
    }

    const bucket = bucketByFamily.get(normalizeLabel(familyLabel));
    if (!bucket) {
      unmappedRows += 1;
      unmappedFacilities = round(unmappedFacilities + count, 2);
      const previous = unmappedFamilies.get(familyLabel) ?? 0;
      unmappedFamilies.set(familyLabel, round(previous + count, 2));
      continue;
    }

    const byType = byTypeByCommune.get(communeCode);
    if (!byType) {
      skippedRows += 1;
      continue;
    }

    byType[bucket] = round(byType[bucket] + count, 2);
    matchedRows += 1;
  }

  if (skippedRows > 0) {
    warnings.push(`sports rows skipped due invalid fields: ${skippedRows}`);
  }
  if (unmappedRows > 0) {
    const topFamilies = [...unmappedFamilies.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([family, count]) => `${family}:${count}`)
      .join(", ");
    warnings.push(
      `sports rows with unmapped equipment family: ${unmappedRows} rows (${unmappedFacilities} facilities). Top unmapped: ${topFamilies}`,
    );
  }

  const byCommune = new Map<string, SportsMetric>();
  for (const communeCode of options.communes) {
    const byType = byTypeByCommune.get(communeCode) ?? createZeroByType();
    const facilitiesTotal = round(
      Object.values(byType).reduce((sum, value) => sum + value, 0),
      2,
    );

    const areaKm2 = options.areaByCommune.get(communeCode);
    if (!areaKm2 || !Number.isFinite(areaKm2) || areaKm2 <= 0) {
      throw new Error(
        `missing or invalid area for sports metric: ${communeCode}`,
      );
    }

    const population = options.populationByCommune.get(communeCode);
    if (!population || !Number.isFinite(population) || population <= 0) {
      throw new Error(
        `missing or invalid population for sports metric: ${communeCode}`,
      );
    }

    byCommune.set(communeCode, {
      facilities_total: facilitiesTotal,
      facilities_per_km2: round(facilitiesTotal / areaKm2, 2),
      facilities_per_10k_residents: round(
        (facilitiesTotal / population) * 10_000,
        2,
      ),
      by_type: byType,
    });
  }

  return {
    byCommune,
    sourceRowCounts: {
      sports_rows_total: parsed.results.length,
      sports_rows_matched: matchedRows,
      sports_rows_unmapped_family: unmappedRows,
    },
    sourceChecksums: {
      sports: sha256(raw),
    },
    sourceUrls: {
      sports: fetchUrl,
    },
    warnings,
  };
}
