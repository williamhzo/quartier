import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";

type NoiseFetchMode = "network-first" | "cache-only";

type NoiseConfig = {
  sourceUrl: string;
  cachePath: string;
  year: number;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
};

export type NoiseMetric = {
  pct_above_lden_threshold: number;
  pct_above_night_threshold: number;
};

export type BuildNoiseFromRoadExposureOutput = {
  byCommune: Map<string, NoiseMetric>;
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

type ParsedNoiseRows = {
  byCommune: Map<string, NoiseMetric>;
  scannedRows: number;
  matchedRows: number;
  warnings: string[];
};

const PARIS_CENTRE_CODES = ["75101", "75102", "75103", "75104"] as const;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitter(max: number): number {
  return Math.floor(Math.random() * max);
}

function getCachePath(cachePath: string): string {
  return path.join(process.cwd(), cachePath);
}

function parseCsvSemicolonLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

function normalizeHeaderCell(value: string): string {
  return value.replace(/^\ufeff/, "").trim();
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;

  const normalized = value
    .trim()
    .replaceAll("\u00a0", "")
    .replaceAll(" ", "")
    .replace(",", ".");

  if (normalized.length === 0 || normalized === "NA") {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function resolveCommuneSuffix(commune: string): string {
  const number = Number.parseInt(commune.slice(3), 10);
  if (!Number.isFinite(number) || number < 1 || number > 20) {
    throw new Error(`invalid arrondissement code for noise: ${commune}`);
  }

  if (number <= 4) return "pariscentre";
  return `${number}eme`;
}

function getRequiredColumns(communes: readonly string[]): string[] {
  const suffixes = new Set(communes.map(resolveCommuneSuffix));
  const columns = ["annee"];
  for (const suffix of suffixes) {
    columns.push(`lden_exposition_vr_${suffix}`);
    columns.push(`ln_exposition_vr_${suffix}`);
  }
  return columns;
}

async function fetchCsvToCache(
  config: NoiseConfig,
  cachePath: string,
): Promise<void> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(config.sourceUrl, {
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
          `noise request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("noise response has no body");
      }

      const tempPath = `${cachePath}.tmp-${Date.now()}`;
      await mkdir(path.dirname(cachePath), { recursive: true });
      const nodeBody =
        response.body as unknown as NodeReadableStream<Uint8Array>;
      await pipeline(Readable.fromWeb(nodeBody), createWriteStream(tempPath));
      await rename(tempPath, cachePath);
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

async function ensureCsvPath(
  mode: NoiseFetchMode,
  config: NoiseConfig,
): Promise<string> {
  const cachePath = getCachePath(config.cachePath);

  try {
    await readFile(cachePath, "utf8");
    return cachePath;
  } catch (error) {
    if (mode === "cache-only") {
      throw new Error(
        `missing noise cache in --offline mode: ${cachePath}. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  await fetchCsvToCache(config, cachePath);
  return cachePath;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getPopulation(
  populationByCommune: Map<string, number>,
  commune: string,
): number {
  const population = populationByCommune.get(commune);
  if (!population || !Number.isFinite(population) || population <= 0) {
    throw new Error(
      `missing or invalid population for noise metric: ${commune}`,
    );
  }
  return population;
}

function getParisCentrePopulation(
  populationByCommune: Map<string, number>,
): number {
  return PARIS_CENTRE_CODES.reduce(
    (sum, code) => sum + getPopulation(populationByCommune, code),
    0,
  );
}

function computePercent(value: number, population: number): number {
  return round((value / population) * 100, 2);
}

async function parseNoiseRows(options: {
  csvPath: string;
  communes: readonly string[];
  targetYear: number;
  populationByCommune: Map<string, number>;
}): Promise<ParsedNoiseRows> {
  const raw = await readFile(options.csvPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("noise csv is empty or missing data rows");
  }

  const header = parseCsvSemicolonLine(lines[0]).map(normalizeHeaderCell);
  const requiredColumns = getRequiredColumns(options.communes);
  for (const required of requiredColumns) {
    if (!header.includes(required)) {
      throw new Error(`noise csv missing required column: ${required}`);
    }
  }

  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvSemicolonLine(line);
    const record: Record<string, string> = {};
    for (let index = 0; index < header.length; index += 1) {
      record[header[index]] = cells[index] ?? "";
    }
    return record;
  });

  const matchingRows = rows.filter((row) => {
    const year = Number.parseInt((row.annee ?? "").trim(), 10);
    return Number.isFinite(year) && year === options.targetYear;
  });

  if (matchingRows.length === 0) {
    const availableYears = rows
      .map((row) => Number.parseInt((row.annee ?? "").trim(), 10))
      .filter((year) => Number.isFinite(year));
    const uniqueYears = [...new Set(availableYears)].sort((a, b) => a - b);

    throw new Error(
      `noise csv missing target year ${options.targetYear}; available years: ${uniqueYears.join(", ") || "none"}`,
    );
  }

  const warnings: string[] = [];
  if (matchingRows.length > 1) {
    warnings.push(
      `noise csv has ${matchingRows.length} rows for year ${options.targetYear}; using last row`,
    );
  }

  const selectedRow = matchingRows[matchingRows.length - 1];
  const byCommune = new Map<string, NoiseMetric>();
  const parisCentrePopulation = getParisCentrePopulation(
    options.populationByCommune,
  );

  const centreLdenRaw = parseNumber(selectedRow.lden_exposition_vr_pariscentre);
  const centreLnRaw = parseNumber(selectedRow.ln_exposition_vr_pariscentre);
  const centreLdenPct =
    centreLdenRaw != null
      ? computePercent(centreLdenRaw, parisCentrePopulation)
      : null;
  const centreLnPct =
    centreLnRaw != null
      ? computePercent(centreLnRaw, parisCentrePopulation)
      : null;

  for (const commune of options.communes) {
    const suffix = resolveCommuneSuffix(commune);
    const population = getPopulation(options.populationByCommune, commune);

    let ldenPct: number | null = null;
    let nightPct: number | null = null;

    if (suffix === "pariscentre") {
      ldenPct = centreLdenPct;
      nightPct = centreLnPct;
    } else {
      const ldenRaw = parseNumber(selectedRow[`lden_exposition_vr_${suffix}`]);
      const nightRaw = parseNumber(selectedRow[`ln_exposition_vr_${suffix}`]);
      ldenPct = ldenRaw != null ? computePercent(ldenRaw, population) : null;
      nightPct = nightRaw != null ? computePercent(nightRaw, population) : null;
    }

    if (ldenPct == null || nightPct == null) {
      warnings.push(
        `missing noise exposure fields for ${commune} in year ${options.targetYear}`,
      );
      continue;
    }

    byCommune.set(commune, {
      pct_above_lden_threshold: ldenPct,
      pct_above_night_threshold: nightPct,
    });
  }

  return {
    byCommune,
    scannedRows: rows.length,
    matchedRows: matchingRows.length,
    warnings,
  };
}

export async function buildNoiseFromRoadExposure(options: {
  communes: readonly string[];
  populationByCommune: Map<string, number>;
  mode: NoiseFetchMode;
  config: NoiseConfig;
}): Promise<BuildNoiseFromRoadExposureOutput> {
  const csvPath = await ensureCsvPath(options.mode, options.config);
  const parsed = await parseNoiseRows({
    csvPath,
    communes: options.communes,
    targetYear: options.config.year,
    populationByCommune: options.populationByCommune,
  });

  const warnings = [...parsed.warnings];
  for (const commune of options.communes) {
    if (!parsed.byCommune.has(commune)) {
      warnings.push(
        `missing noise metrics for ${commune} in year ${options.config.year}`,
      );
    }
  }

  return {
    byCommune: parsed.byCommune,
    sourceRowCounts: {
      noise_rows_scanned: parsed.scannedRows,
      noise_rows_matched: parsed.matchedRows,
    },
    sourceChecksums: {
      noise: sha256(await readFile(csvPath, "utf8")),
    },
    sourceUrls: {
      noise: options.config.sourceUrl,
    },
    warnings,
  };
}
