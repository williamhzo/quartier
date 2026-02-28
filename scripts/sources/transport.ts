import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";

type IdfmFetchMode = "network-first" | "cache-only";

type IdfmTransportConfig = {
  sourceUrl: string;
  cachePath: string;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
};

export type TransportMetric = {
  stations_per_km2: number;
  metro_lines: string[];
};

export type BuildTransportFromIdfmOutput = {
  byCommune: Map<string, TransportMetric>;
  sourceRowCounts: Record<string, number>;
  sourceChecksums: Record<string, string>;
  sourceUrls: Record<string, string>;
  warnings: string[];
};

type IdfmFeature = {
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: {
    mode?: string;
    id_gares?: number | string;
    res_com?: string;
    indice_lig?: string;
    nom_gares?: string;
    geo_point_2d?: {
      lon?: number;
      lat?: number;
    };
    [key: string]: unknown;
  };
};

type IdfmFeatureCollection = {
  type?: string;
  features?: IdfmFeature[];
};

type Boundary = {
  code: string;
  area_km2: number;
  geometry: unknown;
};

type Position = [number, number];

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

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getCachePath(cachePath: string): string {
  return path.join(process.cwd(), cachePath);
}

async function fetchGeojsonToCache(
  config: IdfmTransportConfig,
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
          `idfm transport request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("idfm transport response has no body");
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

async function ensureGeojsonPath(
  mode: IdfmFetchMode,
  config: IdfmTransportConfig,
): Promise<string> {
  const cachePath = getCachePath(config.cachePath);

  try {
    await readFile(cachePath, "utf8");
    return cachePath;
  } catch (error) {
    if (mode === "cache-only") {
      throw new Error(
        `missing idfm transport cache in --offline mode: ${cachePath}. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  await fetchGeojsonToCache(config, cachePath);
  return cachePath;
}

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function pointInRing(point: Position, ring: unknown): boolean {
  if (!Array.isArray(ring) || ring.length < 3) return false;

  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (!isPosition(a) || !isPosition(b)) continue;

    const intersects =
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point: Position, polygon: unknown): boolean {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;

  const outerRing = polygon[0];
  if (!pointInRing(point, outerRing)) return false;

  for (let index = 1; index < polygon.length; index += 1) {
    if (pointInRing(point, polygon[index])) return false;
  }

  return true;
}

function pointInGeometry(point: Position, geometry: unknown): boolean {
  if (!geometry || typeof geometry !== "object") return false;

  const typed = geometry as { type?: string; coordinates?: unknown };
  if (typed.type === "Polygon") {
    return pointInPolygon(point, typed.coordinates);
  }
  if (typed.type === "MultiPolygon" && Array.isArray(typed.coordinates)) {
    return typed.coordinates.some((polygon) => pointInPolygon(point, polygon));
  }

  return false;
}

function getFeaturePoint(feature: IdfmFeature): Position | null {
  const geometry = feature.geometry;
  if (
    geometry?.type === "Point" &&
    Array.isArray(geometry.coordinates) &&
    isPosition(geometry.coordinates)
  ) {
    return geometry.coordinates;
  }

  const lon = feature.properties?.geo_point_2d?.lon;
  const lat = feature.properties?.geo_point_2d?.lat;
  if (typeof lon === "number" && typeof lat === "number") {
    return [lon, lat];
  }

  return null;
}

function buildLineLabel(feature: IdfmFeature): string {
  const mode = (feature.properties?.mode ?? "").trim().toUpperCase();
  const resCom = (feature.properties?.res_com ?? "").trim();
  const indice = (feature.properties?.indice_lig ?? "").trim();

  if (resCom.length > 0) return resCom;
  if (indice.length > 0) return `${mode} ${indice}`.trim();
  return mode || "UNKNOWN";
}

function findContainingBoundaryCode(
  point: Position,
  boundaries: readonly Boundary[],
): string | null {
  for (const boundary of boundaries) {
    if (pointInGeometry(point, boundary.geometry)) {
      return boundary.code;
    }
  }
  return null;
}

export async function buildTransportFromIdfm(options: {
  boundaries: readonly Boundary[];
  mode: IdfmFetchMode;
  config: IdfmTransportConfig;
}): Promise<BuildTransportFromIdfmOutput> {
  const geojsonPath = await ensureGeojsonPath(options.mode, options.config);
  const raw = await readFile(geojsonPath, "utf8");
  const parsed = JSON.parse(raw) as IdfmFeatureCollection;
  const features = Array.isArray(parsed.features) ? parsed.features : [];

  const stationsByCommune = new Map<string, Map<string, Set<string>>>();
  for (const boundary of options.boundaries) {
    stationsByCommune.set(boundary.code, new Map());
  }

  const warnings: string[] = [];
  let totalFeatures = 0;
  let modeFilteredFeatures = 0;
  let assignedRows = 0;
  let skippedNoPoint = 0;

  for (const feature of features) {
    totalFeatures += 1;
    const mode = (feature.properties?.mode ?? "").trim().toUpperCase();
    if (mode !== "METRO" && mode !== "RER") {
      continue;
    }
    modeFilteredFeatures += 1;

    const point = getFeaturePoint(feature);
    if (!point) {
      skippedNoPoint += 1;
      continue;
    }

    const code = findContainingBoundaryCode(point, options.boundaries);
    if (!code) {
      continue;
    }

    const stationIdRaw = feature.properties?.id_gares;
    const stationId =
      stationIdRaw != null
        ? String(stationIdRaw)
        : `${feature.properties?.nom_gares ?? "unknown"}:${point[0]}:${point[1]}`;
    const lineLabel = buildLineLabel(feature);

    const stationMap = stationsByCommune.get(code);
    if (!stationMap) continue;

    const lines = stationMap.get(stationId) ?? new Set<string>();
    lines.add(lineLabel);
    stationMap.set(stationId, lines);
    assignedRows += 1;
  }

  if (skippedNoPoint > 0) {
    warnings.push(`idfm rows skipped without usable point: ${skippedNoPoint}`);
  }

  const byCommune = new Map<string, TransportMetric>();
  for (const boundary of options.boundaries) {
    if (!Number.isFinite(boundary.area_km2) || boundary.area_km2 <= 0) {
      throw new Error(
        `invalid arrondissement area for transport: ${boundary.code}`,
      );
    }

    const stationMap = stationsByCommune.get(boundary.code);
    const stationCount = stationMap?.size ?? 0;
    const lineSet = new Set<string>();
    for (const lines of stationMap?.values() ?? []) {
      for (const line of lines) {
        lineSet.add(line);
      }
    }

    byCommune.set(boundary.code, {
      stations_per_km2: round(stationCount / boundary.area_km2, 4),
      metro_lines: [...lineSet].sort((a, b) => a.localeCompare(b)),
    });
  }

  return {
    byCommune,
    sourceRowCounts: {
      transport_rows_total: totalFeatures,
      transport_rows_mode_filtered: modeFilteredFeatures,
      transport_rows_assigned: assignedRows,
    },
    sourceChecksums: {
      transport: sha256(raw),
    },
    sourceUrls: {
      transport: options.config.sourceUrl,
    },
    warnings,
  };
}
