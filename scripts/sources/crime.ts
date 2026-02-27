import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";

type SsmsiFetchMode = "network-first" | "cache-only";

type SsmsiConfig = {
  sourceUrl: string;
  cachePath: string;
  year: number;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
};

export type SafetyMetric = {
  crime_rate_per_1k: number;
  categories: Record<string, number>;
};

export type BuildSafetyFromSsmsiOutput = {
  byCommune: Map<string, SafetyMetric>;
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

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

async function fetchArchiveToCache(
  config: SsmsiConfig,
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
          `ssmsi request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("ssmsi response has no body");
      }

      const tempPath = `${cachePath}.tmp-${Date.now()}`;
      await mkdir(path.dirname(cachePath), { recursive: true });
      await pipeline(
        Readable.fromWeb(response.body as ReadableStream),
        createWriteStream(tempPath),
      );
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

async function ensureArchivePath(
  mode: SsmsiFetchMode,
  config: SsmsiConfig,
): Promise<string> {
  const cachePath = getCachePath(config.cachePath);

  try {
    await readFile(cachePath);
    return cachePath;
  } catch (error) {
    if (mode === "cache-only") {
      throw new Error(
        `missing ssmsi cache in --offline mode: ${cachePath}. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  await fetchArchiveToCache(config, cachePath);
  return cachePath;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve());
  });

  return hash.digest("hex");
}

type ParsedSafetyRows = {
  byCommune: Map<string, SafetyMetric>;
  scannedRows: number;
  matchedRows: number;
  skippedRowsNoCount: number;
};

async function parseSafetyRowsFromArchive(
  archivePath: string,
  communes: readonly string[],
  targetYear: number,
  populationByCommune: Map<string, number>,
): Promise<ParsedSafetyRows> {
  const communeSet = new Set(communes);
  const rowsByCommune = new Map<
    string,
    { totalCount: number; categories: Map<string, number> }
  >();

  for (const commune of communes) {
    rowsByCommune.set(commune, {
      totalCount: 0,
      categories: new Map(),
    });
  }

  const inputStream = archivePath.endsWith(".gz")
    ? createReadStream(archivePath).pipe(createGunzip())
    : createReadStream(archivePath);
  const rl = createInterface({
    input: inputStream,
    crlfDelay: Infinity,
  });

  let scannedRows = 0;
  let matchedRows = 0;
  let skippedRowsNoCount = 0;

  let idxCode = -1;
  let idxYear = -1;
  let idxIndicator = -1;
  let idxCount = -1;

  for await (const line of rl) {
    if (line.trim().length === 0) continue;

    if (idxCode < 0) {
      const header = parseCsvSemicolonLine(line).map(normalizeHeaderCell);
      idxCode = header.indexOf("CODGEO_2025");
      idxYear = header.indexOf("annee");
      idxIndicator = header.indexOf("indicateur");
      idxCount = header.indexOf("nombre");

      if (idxCode < 0 || idxYear < 0 || idxIndicator < 0 || idxCount < 0) {
        throw new Error(
          "ssmsi csv missing required columns: CODGEO_2025, annee, indicateur, nombre",
        );
      }

      continue;
    }

    scannedRows += 1;
    const row = parseCsvSemicolonLine(line);

    const code = row[idxCode]?.trim();
    if (!communeSet.has(code)) continue;

    const rowYear = Number.parseInt(row[idxYear] ?? "", 10);
    if (!Number.isFinite(rowYear) || rowYear !== targetYear) continue;

    matchedRows += 1;
    const indicator = (row[idxIndicator] ?? "").trim();
    const count = parseNumber(row[idxCount]);

    if (indicator.length === 0 || count == null || count < 0) {
      skippedRowsNoCount += 1;
      continue;
    }

    const entry = rowsByCommune.get(code);
    if (!entry) continue;

    entry.totalCount += count;
    entry.categories.set(
      indicator,
      (entry.categories.get(indicator) ?? 0) + count,
    );
  }

  const byCommune = new Map<string, SafetyMetric>();
  for (const commune of communes) {
    const entry = rowsByCommune.get(commune);
    if (!entry || entry.categories.size === 0) continue;

    const population = populationByCommune.get(commune);
    if (!population || population <= 0) {
      throw new Error(
        `missing or invalid population for safety metric: ${commune}`,
      );
    }

    const categories = Object.fromEntries(
      [...entry.categories.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([indicator, value]) => [indicator, round(value, 2)]),
    );

    byCommune.set(commune, {
      crime_rate_per_1k: round((entry.totalCount / population) * 1_000, 2),
      categories,
    });
  }

  return {
    byCommune,
    scannedRows,
    matchedRows,
    skippedRowsNoCount,
  };
}

export async function buildSafetyFromSsmsi(options: {
  communes: readonly string[];
  populationByCommune: Map<string, number>;
  mode: SsmsiFetchMode;
  config: SsmsiConfig;
}): Promise<BuildSafetyFromSsmsiOutput> {
  const archivePath = await ensureArchivePath(options.mode, options.config);
  const parsed = await parseSafetyRowsFromArchive(
    archivePath,
    options.communes,
    options.config.year,
    options.populationByCommune,
  );

  const warnings: string[] = [];
  for (const code of options.communes) {
    if (!parsed.byCommune.has(code)) {
      warnings.push(
        `missing ssmsi safety metrics for ${code} in year ${options.config.year}`,
      );
    }
  }

  if (parsed.skippedRowsNoCount > 0) {
    warnings.push(
      `ssmsi rows skipped due missing/non-numeric "nombre": ${parsed.skippedRowsNoCount}`,
    );
  }

  return {
    byCommune: parsed.byCommune,
    sourceRowCounts: {
      ssmsi_rows_scanned: parsed.scannedRows,
      ssmsi_rows_matched: parsed.matchedRows,
    },
    sourceChecksums: {
      safety: await sha256File(archivePath),
    },
    sourceUrls: {
      safety: options.config.sourceUrl,
    },
    warnings,
  };
}
