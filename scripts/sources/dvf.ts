import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

type DvfFetchMode = "network-first" | "cache-only";

type DvfSourceConfig = {
  currentYear: number;
  priorYear: number;
  departmentCode: string;
  cacheDir: string;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
  outlierLowerQuantile: number;
  outlierUpperQuantile: number;
};

type DvfYearData = {
  year: number;
  sourceUrl: string;
  rowCount: number;
  checksum: string;
  communeMetrics: Map<
    string,
    { medianPriceM2: number; transactionCount: number }
  >;
};

export type HousingMetric = {
  median_price_m2: number;
  yoy_change: number;
  transaction_count: number;
};

export type BuildHousingFromDvfOutput = {
  byCommune: Map<string, HousingMetric>;
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

function sha256(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function buildDvfSourceUrl(year: number, departmentCode: string): string {
  return `https://files.data.gouv.fr/geo-dvf/latest/csv/${year}/departements/${departmentCode}.csv.gz`;
}

function buildCachePath(
  cacheDir: string,
  year: number,
  departmentCode: string,
): string {
  return path.join(process.cwd(), cacheDir, `${year}-${departmentCode}.csv.gz`);
}

async function fetchWithRetry(
  url: string,
  timeoutMs: number,
  maxRetries: number,
  initialRetryDelayMs: number,
): Promise<Buffer> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, {
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
          `dvf request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`,
        );
      }

      const payload = await response.arrayBuffer();
      return Buffer.from(payload);
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }

      const delay =
        initialRetryDelayMs * 2 ** attempt + randomJitter(initialRetryDelayMs);
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function loadDvfArchive(
  year: number,
  config: DvfSourceConfig,
  mode: DvfFetchMode,
): Promise<{ archive: Buffer; sourceUrl: string }> {
  const sourceUrl = buildDvfSourceUrl(year, config.departmentCode);
  const cachePath = buildCachePath(
    config.cacheDir,
    year,
    config.departmentCode,
  );

  try {
    const archive = await readFile(cachePath);
    return { archive, sourceUrl };
  } catch (error) {
    if (mode === "cache-only") {
      throw new Error(
        `missing dvf cache in --offline mode: ${cachePath}. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  const archive = await fetchWithRetry(
    sourceUrl,
    config.timeoutMs,
    config.maxRetries,
    config.initialRetryDelayMs,
  );

  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, archive);

  return { archive, sourceUrl };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      cell = "";

      if (!(row.length === 1 && row[0] === "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const normalized = value.trim().replaceAll(" ", "").replaceAll("\u00a0", "");
  if (normalized.length === 0) return null;
  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function quantile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) {
    throw new Error("cannot compute quantile on empty array");
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower];
  }
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function trimOutliers(
  values: number[],
  lowerQuantile: number,
  upperQuantile: number,
): number[] {
  if (values.length < 5) {
    return [...values];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const low = quantile(sorted, lowerQuantile);
  const high = quantile(sorted, upperQuantile);
  return sorted.filter((value) => value >= low && value <= high);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function buildCommuneMetrics(
  csvRows: string[][],
  communes: readonly string[],
  config: DvfSourceConfig,
): Map<string, { medianPriceM2: number; transactionCount: number }> {
  if (csvRows.length === 0) {
    throw new Error("dvf csv is empty");
  }

  const header = [...csvRows[0]];
  header[0] = header[0]?.replace(/^\ufeff/, "") ?? header[0];

  const idMutationIndex = header.indexOf("id_mutation");
  const valueIndex = header.indexOf("valeur_fonciere");
  const codeIndex = header.indexOf("code_commune");
  const typeIndex = header.indexOf("type_local");
  const surfaceIndex = header.indexOf("surface_reelle_bati");

  if (
    idMutationIndex < 0 ||
    valueIndex < 0 ||
    codeIndex < 0 ||
    typeIndex < 0 ||
    surfaceIndex < 0
  ) {
    throw new Error("dvf csv missing required columns");
  }

  const communeSet = new Set(communes);
  const grouped = new Map<
    string,
    { commune: string; value: number; surface: number }
  >();

  for (let index = 1; index < csvRows.length; index += 1) {
    const row = csvRows[index];
    if (row.length <= surfaceIndex) continue;

    const communeCode = row[codeIndex]?.trim();
    if (!communeSet.has(communeCode)) continue;

    if (row[typeIndex]?.trim() !== "Appartement") continue;

    const mutationId = row[idMutationIndex]?.trim();
    if (!mutationId) continue;

    const value = parseNumber(row[valueIndex]);
    const surface = parseNumber(row[surfaceIndex]);
    if (value == null || surface == null || value <= 0 || surface <= 0)
      continue;

    const groupKey = `${communeCode}|${mutationId}`;
    const existing = grouped.get(groupKey);

    if (!existing) {
      grouped.set(groupKey, {
        commune: communeCode,
        value,
        surface,
      });
      continue;
    }

    if (Math.abs(existing.value - value) > 1) {
      existing.value = Math.max(existing.value, value);
    }
    existing.surface += surface;
  }

  const pricesByCommune = new Map<string, number[]>();
  for (const code of communes) {
    pricesByCommune.set(code, []);
  }

  for (const group of grouped.values()) {
    const priceM2 = group.value / group.surface;
    if (!Number.isFinite(priceM2) || priceM2 <= 0) continue;
    const list = pricesByCommune.get(group.commune);
    if (!list) continue;
    list.push(priceM2);
  }

  const communeMetrics = new Map<
    string,
    { medianPriceM2: number; transactionCount: number }
  >();
  for (const [code, prices] of pricesByCommune) {
    if (prices.length === 0) continue;
    const trimmed = trimOutliers(
      prices,
      config.outlierLowerQuantile,
      config.outlierUpperQuantile,
    );
    if (trimmed.length === 0) continue;
    communeMetrics.set(code, {
      medianPriceM2: round(median(trimmed), 2),
      transactionCount: trimmed.length,
    });
  }

  return communeMetrics;
}

async function loadDvfYearData(
  year: number,
  communes: readonly string[],
  config: DvfSourceConfig,
  mode: DvfFetchMode,
): Promise<DvfYearData> {
  const { archive, sourceUrl } = await loadDvfArchive(year, config, mode);
  const csvText = gunzipSync(archive).toString("utf8");
  const csvRows = parseCsv(csvText);
  const communeMetrics = buildCommuneMetrics(csvRows, communes, config);

  return {
    year,
    sourceUrl,
    rowCount: Math.max(csvRows.length - 1, 0),
    checksum: sha256(archive),
    communeMetrics,
  };
}

export async function buildHousingFromDvf(options: {
  communes: readonly string[];
  mode: DvfFetchMode;
  config: DvfSourceConfig;
}): Promise<BuildHousingFromDvfOutput> {
  const [currentYearData, priorYearData] = await Promise.all([
    loadDvfYearData(
      options.config.currentYear,
      options.communes,
      options.config,
      options.mode,
    ),
    loadDvfYearData(
      options.config.priorYear,
      options.communes,
      options.config,
      options.mode,
    ),
  ]);

  const byCommune = new Map<string, HousingMetric>();
  const warnings: string[] = [];

  for (const communeCode of options.communes) {
    const currentMetrics = currentYearData.communeMetrics.get(communeCode);
    if (!currentMetrics) continue;

    const priorMetrics = priorYearData.communeMetrics.get(communeCode);
    if (!priorMetrics || priorMetrics.medianPriceM2 <= 0) {
      warnings.push(
        `missing prior-year housing median for ${communeCode}; setting yoy_change=0`,
      );
    }

    const yoy =
      priorMetrics && priorMetrics.medianPriceM2 > 0
        ? ((currentMetrics.medianPriceM2 - priorMetrics.medianPriceM2) /
            priorMetrics.medianPriceM2) *
          100
        : 0;

    byCommune.set(communeCode, {
      median_price_m2: currentMetrics.medianPriceM2,
      yoy_change: round(yoy, 2),
      transaction_count: currentMetrics.transactionCount,
    });
  }

  return {
    byCommune,
    sourceRowCounts: {
      dvf_current: currentYearData.rowCount,
      dvf_prior: priorYearData.rowCount,
    },
    sourceChecksums: {
      dvf_current: currentYearData.checksum,
      dvf_prior: priorYearData.checksum,
    },
    sourceUrls: {
      dvf_current: currentYearData.sourceUrl,
      dvf_prior: priorYearData.sourceUrl,
    },
    warnings,
  };
}
