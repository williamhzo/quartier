import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_CONFIG } from "../data-config";
import { type SireneNightlifeBucket } from "./sirene-naf";

export type NightlifeMetric = {
  restaurants_per_km2: number;
  bars_per_km2: number;
  cafes_per_km2: number;
};

type SnapshotArrondissement = {
  code: string;
  number: number;
  name: string;
  area_km2: number;
  active_establishments_total: number;
  restaurants_count: number;
  bars_cafes_count: number;
  nightlife_extension_count: number;
  restaurants_per_km2: number;
  bars_per_km2: number;
  cafes_per_km2: number;
};

type SnapshotPayload = {
  generated_at: string;
  source: {
    type: string;
    source_url: string;
    stock_path: string;
    stock_size_bytes: number;
    nomenclature: string;
  };
  buckets: {
    restaurants: string[];
    bars_cafes: string[];
    nightlife_extension: string[];
  };
  stats: {
    commune_count: number;
    active_establishments_total: number;
    restaurants_count_total: number;
    bars_cafes_count_total: number;
    nightlife_extension_count_total: number;
  };
  notes: string[];
  arrondissements: SnapshotArrondissement[];
};

export type BuildNightlifeFromSnapshotOutput = {
  byCommune: Map<string, NightlifeMetric>;
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertSnapshotRow(value: unknown): asserts value is SnapshotArrondissement {
  if (!isRecord(value)) {
    throw new Error("invalid nightlife snapshot row: expected object");
  }

  const requiredStringFields = ["code", "name"] as const;
  for (const field of requiredStringFields) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new Error(`invalid nightlife snapshot row: missing ${field}`);
    }
  }

  const requiredNumberFields = [
    "number",
    "area_km2",
    "active_establishments_total",
    "restaurants_count",
    "bars_cafes_count",
    "nightlife_extension_count",
    "restaurants_per_km2",
    "bars_per_km2",
    "cafes_per_km2",
  ] as const;
  for (const field of requiredNumberFields) {
    if (!isFiniteNumber(value[field])) {
      throw new Error(`invalid nightlife snapshot row: missing ${field}`);
    }
  }
}

function assertSnapshotPayload(value: unknown): asserts value is SnapshotPayload {
  if (!isRecord(value)) {
    throw new Error("invalid nightlife snapshot: expected object");
  }
  if (!isRecord(value.source) || !isRecord(value.stats)) {
    throw new Error("invalid nightlife snapshot: missing source/stats");
  }
  if (!Array.isArray(value.arrondissements)) {
    throw new Error("invalid nightlife snapshot: missing arrondissements");
  }
  if (value.source.nomenclature !== "NAFRev2") {
    throw new Error(
      `invalid nightlife snapshot: expected nomenclature NAFRev2, found ${String(
        value.source.nomenclature,
      )}`,
    );
  }

  for (const row of value.arrondissements) {
    assertSnapshotRow(row);
  }
}

function getSnapshotPath(customPath?: string): string {
  const resolvedPath = customPath ?? DATA_CONFIG.sources.sirene.snapshotPath;
  if (path.isAbsolute(resolvedPath)) {
    return resolvedPath;
  }

  return path.join(process.cwd(), resolvedPath);
}

function resolvePythonBinary(): string {
  const localVenvPython = path.join(
    process.cwd(),
    ".venv-sirene",
    "bin",
    "python",
  );
  if (existsSync(localVenvPython)) {
    return localVenvPython;
  }

  return "python3";
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.000001;
}

export async function readSireneNightlifeSnapshot(
  customPath?: string,
): Promise<SnapshotPayload> {
  const filePath = getSnapshotPath(customPath);
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  assertSnapshotPayload(parsed);
  return parsed;
}

export async function refreshSireneNightlifeSnapshot(options?: {
  stockPath?: string;
  outPath?: string;
}): Promise<void> {
  const stockPath = path.join(
    process.cwd(),
    options?.stockPath ?? DATA_CONFIG.sources.sirene.stockPath,
  );
  const outPath = getSnapshotPath(options?.outPath);
  const scriptPath = path.join(
    process.cwd(),
    DATA_CONFIG.sources.sirene.generatorScriptPath,
  );
  const areasPath = path.join(process.cwd(), "data", "arrondissements.json");
  const pythonBin = resolvePythonBinary();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [
        scriptPath,
        "--stock",
        stockPath,
        "--areas",
        areasPath,
        "--out",
        outPath,
      ],
      { stdio: "inherit" },
    );

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`nightlife snapshot generator exited with code ${code ?? -1}`),
      );
    });
  });
}

export async function buildNightlifeFromSnapshot(options: {
  communes: readonly string[];
  areaByCommune: Map<string, number>;
  buckets: readonly SireneNightlifeBucket[];
  expectedNomenclatures?: readonly string[];
}): Promise<BuildNightlifeFromSnapshotOutput> {
  const filePath = getSnapshotPath();
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  assertSnapshotPayload(parsed);

  if (
    options.expectedNomenclatures &&
    options.expectedNomenclatures.length > 0 &&
    !options.expectedNomenclatures.includes(parsed.source.nomenclature)
  ) {
    throw new Error(
      `nightlife snapshot nomenclature mismatch: expected one of [${options.expectedNomenclatures.join(
        ", ",
      )}], received ${parsed.source.nomenclature}`,
    );
  }

  const rowsByCode = new Map(
    parsed.arrondissements.map((row) => [row.code, row] as const),
  );
  const byCommune = new Map<string, NightlifeMetric>();
  const warnings = [
    "cafes_per_km2 mirrors bars_per_km2 because SIRENE v1 buckets bars and cafes together under NAF 56.30Z",
  ];

  if (options.buckets.includes("nightlife_extension")) {
    warnings.push(
      "nightlife_extension counts are present in the snapshot but excluded from the default nightlife density fields",
    );
  }

  for (const communeCode of options.communes) {
    const areaKm2 = options.areaByCommune.get(communeCode);
    if (!areaKm2 || !Number.isFinite(areaKm2) || areaKm2 <= 0) {
      throw new Error(
        `missing or invalid area for nightlife metric: ${communeCode}`,
      );
    }

    const row = rowsByCode.get(communeCode);
    if (!row) {
      throw new Error(`missing nightlife snapshot row for ${communeCode}`);
    }
    if (!approximatelyEqual(row.area_km2, areaKm2)) {
      throw new Error(
        `nightlife snapshot area mismatch for ${communeCode}: snapshot=${row.area_km2}, current=${areaKm2}`,
      );
    }

    byCommune.set(communeCode, {
      restaurants_per_km2: row.restaurants_per_km2,
      bars_per_km2: row.bars_per_km2,
      cafes_per_km2: row.cafes_per_km2,
    });
  }

  return {
    byCommune,
    sourceRowCounts: {
      sirene_active_establishments_total: parsed.stats.active_establishments_total,
      sirene_restaurants_total: parsed.stats.restaurants_count_total,
      sirene_bars_cafes_total: parsed.stats.bars_cafes_count_total,
      sirene_nightlife_extension_total:
        parsed.stats.nightlife_extension_count_total,
    },
    sourceChecksums: {
      sirene_snapshot: createHash("sha256").update(raw).digest("hex"),
    },
    sourceUrls: {
      sirene: parsed.source.source_url,
    },
    warnings,
  };
}
