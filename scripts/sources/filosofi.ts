import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import path from "node:path";

type FetchMode = "network-first" | "cache-only";

type FilosofiConfig = {
  sourceUrl: string;
  csvFileName: string;
  cachePath: string;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
  fields: {
    code: string;
    population: string;
    medianIncome: string;
    povertyRate: string;
  };
};

export type IncomeMetric = {
  median_household: number;
  poverty_rate: number;
};

export type SharedIncomePopulationOutput = {
  incomeByCommune: Map<string, IncomeMetric>;
  populationByCommune: Map<string, number>;
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

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const normalized = value
    .trim()
    .replaceAll("\u00a0", "")
    .replaceAll(" ", "")
    .replace(",", ".");

  if (
    normalized.length === 0 ||
    normalized === "s" ||
    normalized === "nd" ||
    normalized === "ns"
  ) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function extractColumnsByIndex(
  line: string,
  indices: readonly number[],
): Map<number, string> {
  const out = new Map<number, string>();
  const target = new Set(indices);
  const max = Math.max(...indices);

  let fieldIndex = 0;
  let start = 0;
  for (let index = 0; index <= line.length; index += 1) {
    if (index === line.length || line[index] === ";") {
      if (target.has(fieldIndex)) {
        out.set(fieldIndex, line.slice(start, index));
      }

      if (fieldIndex >= max) break;
      fieldIndex += 1;
      start = index + 1;
    }
  }

  return out;
}

function getCachePath(cachePath: string): string {
  return path.join(process.cwd(), cachePath);
}

async function fetchArchiveToCache(
  config: FilosofiConfig,
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
          `filosofi request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("filosofi response has no body");
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
      if (attempt >= config.maxRetries) {
        throw error;
      }

      const delay =
        config.initialRetryDelayMs * 2 ** attempt +
        randomJitter(config.initialRetryDelayMs);
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function ensureArchivePath(
  mode: FetchMode,
  config: FilosofiConfig,
): Promise<string> {
  const cachePath = getCachePath(config.cachePath);

  try {
    await readFile(cachePath);
    return cachePath;
  } catch (error) {
    if (mode === "cache-only") {
      throw new Error(
        `missing filosofi cache in --offline mode: ${cachePath}. (${error instanceof Error ? error.message : String(error)})`,
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

type ParsedRows = {
  incomeByCommune: Map<string, IncomeMetric>;
  populationByCommune: Map<string, number>;
  scannedRows: number;
};

async function parseRequiredRowsFromArchive(
  archivePath: string,
  communes: readonly string[],
  config: FilosofiConfig,
): Promise<ParsedRows> {
  const communeSet = new Set(communes);
  const maxCommuneCode = [...communes].sort().at(-1) ?? "75120";

  const incomeByCommune = new Map<string, IncomeMetric>();
  const populationByCommune = new Map<string, number>();

  const unzip = spawn("unzip", ["-p", archivePath, config.csvFileName], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdout = unzip.stdout;
  const stderr = unzip.stderr;
  if (!stdout || !stderr) {
    throw new Error("failed to spawn unzip for filosofi archive");
  }

  let stderrBuffer = "";
  let spawnError: Error | null = null;
  unzip.on("error", (error) => {
    spawnError = error;
  });
  stderr.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString("utf8");
  });

  const rl = createInterface({
    input: stdout,
    crlfDelay: Infinity,
  });

  let scannedRows = 0;
  let shouldStopEarly = false;
  let seenParisRange = false;

  let idxCode = -1;
  let idxPopulation = -1;
  let idxMedianIncome = -1;
  let idxPoverty = -1;

  for await (const line of rl) {
    if (idxCode < 0) {
      const header = line.split(";");
      idxCode = header.indexOf(config.fields.code);
      idxPopulation = header.indexOf(config.fields.population);
      idxMedianIncome = header.indexOf(config.fields.medianIncome);
      idxPoverty = header.indexOf(config.fields.povertyRate);

      if (
        idxCode < 0 ||
        idxPopulation < 0 ||
        idxMedianIncome < 0 ||
        idxPoverty < 0
      ) {
        throw new Error(
          `missing expected filosofi columns: ${config.fields.code}, ${config.fields.population}, ${config.fields.medianIncome}, ${config.fields.povertyRate}`,
        );
      }

      continue;
    }

    if (line.trim().length === 0) continue;
    scannedRows += 1;

    const firstSeparator = line.indexOf(";");
    const code = (
      firstSeparator === -1 ? line : line.slice(0, firstSeparator)
    ).trim();
    if (code >= "75100" && code <= "75199") {
      seenParisRange = true;
    }

    if (communeSet.has(code)) {
      const fields = extractColumnsByIndex(line, [
        idxPopulation,
        idxMedianIncome,
        idxPoverty,
      ]);

      const population = parseNumber(fields.get(idxPopulation));
      const medianIncome = parseNumber(fields.get(idxMedianIncome));
      const povertyRate = parseNumber(fields.get(idxPoverty));

      if (population != null && population > 0) {
        populationByCommune.set(code, Math.round(population));
      }

      if (medianIncome != null && povertyRate != null) {
        incomeByCommune.set(code, {
          median_household: round(medianIncome, 2),
          poverty_rate: round(povertyRate, 2),
        });
      }
    }

    if (seenParisRange && code.length === 5 && code > maxCommuneCode) {
      shouldStopEarly = true;
      rl.close();
      unzip.kill("SIGTERM");
      break;
    }
  }

  const closeResult = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    unzip.on("close", (code, signal) => resolve({ code, signal }));
  });

  if (spawnError) {
    throw new Error(
      `failed to execute unzip for filosofi parsing: ${spawnError.message}`,
    );
  }

  if (!shouldStopEarly && closeResult.code !== 0) {
    throw new Error(
      `failed to unzip filosofi csv (exit ${closeResult.code}): ${stderrBuffer.slice(0, 300)}`,
    );
  }

  return {
    incomeByCommune,
    populationByCommune,
    scannedRows,
  };
}

export async function loadIncomePopulationFromFilosofi(options: {
  mode: FetchMode;
  communes: readonly string[];
  config: FilosofiConfig;
}): Promise<SharedIncomePopulationOutput> {
  const archivePath = await ensureArchivePath(options.mode, options.config);
  const parsed = await parseRequiredRowsFromArchive(
    archivePath,
    options.communes,
    options.config,
  );

  const warnings: string[] = [];
  for (const code of options.communes) {
    if (!parsed.populationByCommune.has(code)) {
      throw new Error(`missing filosofi population for ${code}`);
    }
    if (!parsed.incomeByCommune.has(code)) {
      warnings.push(`missing filosofi income metrics for ${code}`);
    }
  }

  return {
    incomeByCommune: parsed.incomeByCommune,
    populationByCommune: parsed.populationByCommune,
    sourceRowCounts: {
      filosofi_rows_scanned: parsed.scannedRows,
      filosofi_rows_matched: parsed.incomeByCommune.size,
    },
    sourceChecksums: {
      filosofi: await sha256File(archivePath),
    },
    sourceUrls: {
      filosofi: options.config.sourceUrl,
    },
    warnings,
  };
}
