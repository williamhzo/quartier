import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

type BpeFetchMode = "network-first" | "cache-only";

type BpeAmenitiesConfig = {
  apiBaseUrl: string;
  sourceUrl: string;
  cachePath: string;
  year: string;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
  maxRecords: number;
  equipmentCodes: {
    pharmacies: string[];
    doctors: string[];
    schools: string[];
    gyms: string[];
    cinemas: string[];
  };
  cultureCodebook: {
    version: string;
    byType: Record<string, string[]>;
  };
};

export type AmenitiesMetric = {
  pharmacies: number;
  doctors: number;
  schools: number;
  gyms: number;
  cinemas: number;
};

export type BuildAmenitiesFromBpeOutput = {
  byCommune: Map<string, AmenitiesMetric>;
  byEquipmentByCommune: Map<string, Map<string, number>>;
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

type AggregatedBpeRow = {
  com_arm_code?: unknown;
  equipment_code?: unknown;
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

function buildBpeQueryUrl(
  communes: readonly string[],
  config: BpeAmenitiesConfig,
): string {
  const amenityCodes = Object.values(config.equipmentCodes).flat();
  const cultureCodes = Object.values(config.cultureCodebook.byType).flat();
  const equipmentCodes = [...new Set([...amenityCodes, ...cultureCodes])];
  const where = `year=date'${config.year}' and com_arm_code in (${encodeQuotedList(communes)}) and equipment_code in (${encodeQuotedList(equipmentCodes)})`;

  const params = new URLSearchParams({
    select: "com_arm_code,equipment_code,sum(ctvalue) as count",
    group_by: "com_arm_code,equipment_code",
    where,
    limit: String(config.maxRecords),
  });

  return `${config.apiBaseUrl}?${params.toString()}`;
}

async function fetchResponseToCache(
  fetchUrl: string,
  config: BpeAmenitiesConfig,
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
          `bpe request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("bpe response has no body");
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
  mode: BpeFetchMode,
  fetchUrl: string,
  config: BpeAmenitiesConfig,
): Promise<string> {
  const cachePath = getCachePath(config.cachePath);
  const queryMarkerPath = getQueryMarkerPath(cachePath);

  try {
    await readFile(cachePath, "utf8");
    try {
      const cachedQuery = (await readFile(queryMarkerPath, "utf8")).trim();
      if (cachedQuery === fetchUrl) {
        return cachePath;
      }

      if (mode === "cache-only") {
        throw new Error(
          `stale bpe cache in --offline mode: query changed. expected ${fetchUrl}`,
        );
      }

      await fetchResponseToCache(fetchUrl, config, cachePath);
      return cachePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string }).code;
      if (code === "ENOENT") {
        // Backfill path for legacy caches that predate query markers.
        if (mode === "cache-only") {
          return cachePath;
        }

        await fetchResponseToCache(fetchUrl, config, cachePath);
        return cachePath;
      }

      if (mode === "cache-only") {
        if (message.startsWith("stale bpe cache in --offline mode")) {
          throw new Error(message);
        }
      }

      if (mode !== "cache-only") {
        await fetchResponseToCache(fetchUrl, config, cachePath);
        return cachePath;
      }

      throw error;
    }
  } catch (error) {
    if (mode === "cache-only") {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("stale bpe cache in --offline mode")) {
        throw new Error(message);
      }
      throw new Error(
        `missing bpe cache in --offline mode: ${cachePath}. (${message})`,
      );
    }
  }

  await fetchResponseToCache(fetchUrl, config, cachePath);
  return cachePath;
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

export async function buildAmenitiesFromBpe(options: {
  communes: readonly string[];
  mode: BpeFetchMode;
  config: BpeAmenitiesConfig;
}): Promise<BuildAmenitiesFromBpeOutput> {
  const fetchUrl = buildBpeQueryUrl(options.communes, options.config);
  const responsePath = await ensureResponsePath(
    options.mode,
    fetchUrl,
    options.config,
  );
  const raw = await readFile(responsePath, "utf8");

  const parsed = JSON.parse(raw) as {
    total_count?: unknown;
    results?: unknown;
  };

  if (!Array.isArray(parsed.results)) {
    throw new Error("invalid bpe response payload: missing results array");
  }

  const totalCount = readNumberField(parsed.total_count);
  if (
    totalCount != null &&
    Number.isFinite(totalCount) &&
    totalCount > options.config.maxRecords
  ) {
    throw new Error(
      `bpe response truncated: total_count ${totalCount} exceeds configured limit ${options.config.maxRecords}`,
    );
  }

  const warnings: string[] = [];
  const communeSet = new Set(options.communes);

  const pharmacyCodes = new Set(options.config.equipmentCodes.pharmacies);
  const doctorCodes = new Set(options.config.equipmentCodes.doctors);
  const schoolCodes = new Set(options.config.equipmentCodes.schools);
  const gymCodes = new Set(options.config.equipmentCodes.gyms);
  const cinemaCodes = new Set(options.config.equipmentCodes.cinemas);

  const aggregateByCommune = new Map<string, AmenitiesMetric>();
  const byEquipmentByCommune = new Map<string, Map<string, number>>();
  for (const commune of options.communes) {
    aggregateByCommune.set(commune, {
      pharmacies: 0,
      doctors: 0,
      schools: 0,
      gyms: 0,
      cinemas: 0,
    });
    byEquipmentByCommune.set(commune, new Map<string, number>());
  }

  let matchedRows = 0;
  let skippedRows = 0;

  for (const row of parsed.results as AggregatedBpeRow[]) {
    const commune = readStringField(row.com_arm_code);
    const equipmentCode = readStringField(row.equipment_code);
    const count = readNumberField(row.count);

    if (!commune || !equipmentCode || count == null || count < 0) {
      skippedRows += 1;
      continue;
    }

    if (!communeSet.has(commune)) {
      continue;
    }

    const aggregate = aggregateByCommune.get(commune);
    if (!aggregate) continue;
    const equipmentByCommune = byEquipmentByCommune.get(commune);
    if (!equipmentByCommune) continue;

    if (pharmacyCodes.has(equipmentCode)) {
      aggregate.pharmacies = round(aggregate.pharmacies + count, 2);
    }
    if (doctorCodes.has(equipmentCode)) {
      aggregate.doctors = round(aggregate.doctors + count, 2);
    }
    if (schoolCodes.has(equipmentCode)) {
      aggregate.schools = round(aggregate.schools + count, 2);
    }
    if (gymCodes.has(equipmentCode)) {
      aggregate.gyms = round(aggregate.gyms + count, 2);
    }
    if (cinemaCodes.has(equipmentCode)) {
      aggregate.cinemas = round(aggregate.cinemas + count, 2);
    }
    const previousEquipmentCount = equipmentByCommune.get(equipmentCode) ?? 0;
    equipmentByCommune.set(
      equipmentCode,
      round(previousEquipmentCount + count, 2),
    );

    matchedRows += 1;
  }

  if (skippedRows > 0) {
    warnings.push(`bpe rows skipped due invalid fields: ${skippedRows}`);
  }

  const byCommune = new Map<string, AmenitiesMetric>();
  for (const commune of options.communes) {
    const aggregate = aggregateByCommune.get(commune);
    if (!aggregate) continue;
    byCommune.set(commune, aggregate);
  }

  return {
    byCommune,
    byEquipmentByCommune,
    sourceRowCounts: {
      bpe_rows_total: parsed.results.length,
      bpe_rows_matched: matchedRows,
    },
    sourceChecksums: {
      bpe: sha256(raw),
    },
    sourceUrls: {
      bpe: fetchUrl,
    },
    warnings,
  };
}
