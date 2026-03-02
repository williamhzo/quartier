import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

type CultureFetchMode = "network-first" | "cache-only";

export type CultureByType = {
  cinemas: number;
  libraries: number;
  heritage: number;
  livePerformanceVenues: number;
  archives: number;
  museums: number;
};

type CultureBucket = keyof CultureByType;

type BasilicCultureConfig = {
  apiBaseUrl: string;
  sourceUrl: string;
  cachePath: string;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
  maxRecords: number;
  typeMapping: Record<CultureBucket, string[]>;
};

type RawBasilicRow = {
  code_insee?: unknown;
  identifiant_origine?: unknown;
  type_equipement_ou_lieu?: unknown;
  nom?: unknown;
  adresse_postale?: unknown;
};

type RawBasilicResponse =
  | RawBasilicRow[]
  | {
      results?: unknown;
    };

export type BuildCultureFromBasilicOutput = {
  byCommune: Map<string, CultureByType>;
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

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDedupPart(value: string): string {
  return normalizeLabel(value);
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

function buildBasilicQueryUrl(
  communes: readonly string[],
  config: BasilicCultureConfig,
): string {
  const where = `code_insee in (${encodeQuotedList(communes)})`;
  const params = new URLSearchParams({
    select:
      "code_insee,identifiant_origine,type_equipement_ou_lieu,nom,adresse_postale",
    where,
    limit: "-1",
  });
  return `${config.apiBaseUrl}?${params.toString()}`;
}

async function fetchResponseToCache(
  fetchUrl: string,
  config: BasilicCultureConfig,
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
          `culture request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("culture response has no body");
      }

      const tempPath = `${cachePath}.tmp-${Date.now()}`;
      await mkdir(path.dirname(cachePath), { recursive: true });
      const responseBody =
        response.body as unknown as NodeReadableStream<Uint8Array>;
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
  mode: CultureFetchMode,
  fetchUrl: string,
  config: BasilicCultureConfig,
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
          `stale culture cache in --offline mode: query changed. expected ${fetchUrl}`,
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
        message.startsWith("stale culture cache in --offline mode")
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
      if (message.startsWith("stale culture cache in --offline mode")) {
        throw new Error(message);
      }
      throw new Error(
        `missing culture cache in --offline mode: ${cachePath}. (${message})`,
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

function createZeroByType(): CultureByType {
  return {
    cinemas: 0,
    libraries: 0,
    heritage: 0,
    livePerformanceVenues: 0,
    archives: 0,
    museums: 0,
  };
}

function buildTypeToBucketMap(
  mapping: BasilicCultureConfig["typeMapping"],
): Map<string, CultureBucket> {
  const typeToBucket = new Map<string, CultureBucket>();
  for (const [bucket, types] of Object.entries(mapping) as Array<
    [CultureBucket, string[]]
  >) {
    for (const type of types) {
      const normalized = normalizeLabel(type);
      const existing = typeToBucket.get(normalized);
      if (existing && existing !== bucket) {
        throw new Error(
          `culture type mapping conflict for "${type}": ${existing} vs ${bucket}`,
        );
      }
      typeToBucket.set(normalized, bucket);
    }
  }
  return typeToBucket;
}

function toRowList(payload: RawBasilicResponse): RawBasilicRow[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.results)) {
    return payload.results as RawBasilicRow[];
  }

  throw new Error(
    "invalid culture response payload: expected array or object with results",
  );
}

function buildDedupKey(
  row: RawBasilicRow,
  communeCode: string,
  normalizedType: string,
): { key: string; usedFallback: boolean } {
  const originId = readStringField(row.identifiant_origine);
  if (originId) {
    return { key: `${communeCode}::${originId}`, usedFallback: false };
  }

  const name = normalizeDedupPart(readStringField(row.nom) ?? "");
  const address = normalizeDedupPart(
    readStringField(row.adresse_postale) ?? "",
  );

  return {
    key: `${communeCode}::${normalizedType}::${name}::${address}`,
    usedFallback: true,
  };
}

export async function buildCultureFromBasilic(options: {
  communes: readonly string[];
  mode: CultureFetchMode;
  config: BasilicCultureConfig;
}): Promise<BuildCultureFromBasilicOutput> {
  const fetchUrl = buildBasilicQueryUrl(options.communes, options.config);
  const response = await ensureResponsePath(
    options.mode,
    fetchUrl,
    options.config,
  );
  const raw = await readFile(response.responsePath, "utf8");

  const parsed = JSON.parse(raw) as RawBasilicResponse;
  const rows = toRowList(parsed);
  if (rows.length > options.config.maxRecords) {
    throw new Error(
      `culture response size ${rows.length} exceeds configured limit ${options.config.maxRecords}`,
    );
  }

  const warnings: string[] = [];
  if (response.usedLegacyCacheWithoutQueryMarker) {
    warnings.push(
      `culture cache query marker missing (${getQueryMarkerPath(options.config.cachePath)}); accepted legacy cache in --offline mode. Refresh online with: bun run data:refresh --dimensions=culture`,
    );
  }

  const communeSet = new Set(options.communes);
  const typeToBucket = buildTypeToBucketMap(options.config.typeMapping);
  const byTypeByCommune = new Map<string, CultureByType>();
  for (const communeCode of options.communes) {
    byTypeByCommune.set(communeCode, createZeroByType());
  }

  let matchedRows = 0;
  let skippedRows = 0;
  let deduplicatedRows = 0;
  let unmappedRows = 0;
  let fallbackDedupRows = 0;
  const unmappedTypeCounts = new Map<string, number>();
  const dedupKeySet = new Set<string>();

  for (const row of rows) {
    const communeCode = readStringField(row.code_insee);
    const rawType = readStringField(row.type_equipement_ou_lieu);
    if (!communeCode || !rawType) {
      skippedRows += 1;
      continue;
    }

    if (!communeSet.has(communeCode)) {
      continue;
    }

    const normalizedType = normalizeLabel(rawType);
    const bucket = typeToBucket.get(normalizedType);
    if (!bucket) {
      unmappedRows += 1;
      const previous = unmappedTypeCounts.get(rawType) ?? 0;
      unmappedTypeCounts.set(rawType, previous + 1);
      continue;
    }

    const dedupKey = buildDedupKey(row, communeCode, normalizedType);
    if (dedupKey.usedFallback) {
      fallbackDedupRows += 1;
    }

    if (dedupKeySet.has(dedupKey.key)) {
      deduplicatedRows += 1;
      continue;
    }
    dedupKeySet.add(dedupKey.key);

    const byType = byTypeByCommune.get(communeCode);
    if (!byType) {
      skippedRows += 1;
      continue;
    }

    byType[bucket] = round(byType[bucket] + 1, 2);
    matchedRows += 1;
  }

  if (skippedRows > 0) {
    warnings.push(`culture rows skipped due invalid fields: ${skippedRows}`);
  }
  if (unmappedRows > 0) {
    const topUnmapped = [...unmappedTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([type, count]) => `${type}:${count}`)
      .join(", ");
    warnings.push(
      `culture rows with unmapped type_equipement_ou_lieu: ${unmappedRows} rows. Top unmapped: ${topUnmapped}`,
    );
  }

  const byCommune = new Map<string, CultureByType>();
  for (const communeCode of options.communes) {
    byCommune.set(
      communeCode,
      byTypeByCommune.get(communeCode) ?? createZeroByType(),
    );
  }

  return {
    byCommune,
    sourceRowCounts: {
      culture_rows_total: rows.length,
      culture_rows_matched: matchedRows,
      culture_rows_unmapped_type: unmappedRows,
      culture_rows_deduplicated: deduplicatedRows,
      culture_rows_dedup_fallback: fallbackDedupRows,
    },
    sourceChecksums: {
      culture: sha256(raw),
    },
    sourceUrls: {
      culture: fetchUrl,
    },
    warnings,
  };
}
