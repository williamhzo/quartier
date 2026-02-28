import { area, bbox, featureCollection, intersect } from "@turf/turf";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import type {
  BBox,
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  MultiPolygon,
  Polygon,
} from "geojson";

type GreenSpaceFetchMode = "network-first" | "cache-only";

type GreenSpaceConfig = {
  sourceUrl: string;
  cachePath: string;
  timeoutMs: number;
  maxRetries: number;
  initialRetryDelayMs: number;
};

type Boundary = {
  code: string;
  geometry: unknown;
};

type BoundaryAccumulator = {
  code: string;
  population: number;
  bbox: BBox;
  feature: Feature<Polygon | MultiPolygon>;
  totalAreaM2: number;
  parkCount: number;
};

export type GreenSpaceMetric = {
  total_area_m2: number;
  m2_per_resident: number;
  park_count: number;
};

export type BuildGreenSpaceFromParisOpenDataOutput = {
  byCommune: Map<string, GreenSpaceMetric>;
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

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function isPolygonLikeGeometry(
  value: unknown,
): value is Polygon | MultiPolygon {
  if (!value || typeof value !== "object") return false;
  const typed = value as { type?: unknown; coordinates?: unknown };
  if (typed.type !== "Polygon" && typed.type !== "MultiPolygon") return false;
  return Array.isArray(typed.coordinates);
}

function bboxOverlaps(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

async function fetchGeojsonToCache(
  config: GreenSpaceConfig,
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
          `green-space request failed (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      if (!response.body) {
        throw new Error("green-space response has no body");
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
  mode: GreenSpaceFetchMode,
  config: GreenSpaceConfig,
): Promise<string> {
  const cachePath = getCachePath(config.cachePath);

  try {
    await readFile(cachePath, "utf8");
    return cachePath;
  } catch (error) {
    if (mode === "cache-only") {
      throw new Error(
        `missing green-space cache in --offline mode: ${cachePath}. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  await fetchGeojsonToCache(config, cachePath);
  return cachePath;
}

function createBoundaryAccumulators(options: {
  boundaries: readonly Boundary[];
  populationByCommune: Map<string, number>;
}): BoundaryAccumulator[] {
  return options.boundaries.map((boundary) => {
    const geometry = boundary.geometry;
    if (!isPolygonLikeGeometry(geometry)) {
      throw new Error(
        `invalid boundary geometry for green-space: ${boundary.code}`,
      );
    }

    const population = options.populationByCommune.get(boundary.code);
    if (!population || !Number.isFinite(population) || population <= 0) {
      throw new Error(
        `missing or invalid population for green-space: ${boundary.code}`,
      );
    }

    const feature: Feature<Polygon | MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry,
    };

    return {
      code: boundary.code,
      population,
      bbox: bbox(feature),
      feature,
      totalAreaM2: 0,
      parkCount: 0,
    };
  });
}

export async function buildGreenSpaceFromParisOpenData(options: {
  boundaries: readonly Boundary[];
  populationByCommune: Map<string, number>;
  mode: GreenSpaceFetchMode;
  config: GreenSpaceConfig;
}): Promise<BuildGreenSpaceFromParisOpenDataOutput> {
  const geojsonPath = await ensureGeojsonPath(options.mode, options.config);
  const raw = await readFile(geojsonPath, "utf8");
  const parsed = JSON.parse(raw) as FeatureCollection<
    Geometry,
    GeoJsonProperties
  >;

  if (!Array.isArray(parsed.features)) {
    throw new Error("invalid green-space payload: missing features array");
  }

  const boundaries = createBoundaryAccumulators({
    boundaries: options.boundaries,
    populationByCommune: options.populationByCommune,
  });
  const warnings: string[] = [];

  let polygonFeatures = 0;
  let skippedNonPolygon = 0;
  let attemptedIntersections = 0;
  let successfulIntersections = 0;
  let intersectionErrors = 0;

  for (const parkFeature of parsed.features) {
    if (!isPolygonLikeGeometry(parkFeature.geometry)) {
      skippedNonPolygon += 1;
      continue;
    }
    polygonFeatures += 1;

    const typedParkFeature: Feature<Polygon | MultiPolygon> = {
      type: "Feature",
      properties: parkFeature.properties ?? {},
      geometry: parkFeature.geometry,
    };
    const parkBbox = bbox(typedParkFeature);

    for (const boundary of boundaries) {
      if (!bboxOverlaps(parkBbox, boundary.bbox)) continue;
      attemptedIntersections += 1;

      try {
        const overlap = intersect(
          featureCollection([boundary.feature, typedParkFeature]),
        );
        if (!overlap) continue;

        const overlapArea = area(overlap);
        if (!Number.isFinite(overlapArea) || overlapArea <= 0) continue;

        boundary.totalAreaM2 += overlapArea;
        boundary.parkCount += 1;
        successfulIntersections += 1;
      } catch {
        intersectionErrors += 1;
      }
    }
  }

  if (skippedNonPolygon > 0) {
    warnings.push(
      `green-space parser skipped ${skippedNonPolygon} non-polygon features`,
    );
  }
  if (intersectionErrors > 0) {
    warnings.push(
      `green-space parser skipped ${intersectionErrors} intersections due to geometry errors`,
    );
  }

  const byCommune = new Map<string, GreenSpaceMetric>();
  for (const boundary of boundaries) {
    const totalAreaM2 = round(boundary.totalAreaM2, 2);
    byCommune.set(boundary.code, {
      total_area_m2: totalAreaM2,
      m2_per_resident: round(totalAreaM2 / boundary.population, 2),
      park_count: boundary.parkCount,
    });
  }

  return {
    byCommune,
    sourceRowCounts: {
      green_space_features_total: parsed.features.length,
      green_space_features_polygonal: polygonFeatures,
      green_space_intersections_attempted: attemptedIntersections,
      green_space_intersections_successful: successfulIntersections,
    },
    sourceChecksums: {
      green_space: sha256(raw),
    },
    sourceUrls: {
      greenSpace: options.config.sourceUrl,
    },
    warnings,
  };
}
