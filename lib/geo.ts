import { readFile } from "fs/promises";
import { join } from "path";
import type { FeatureCollection, Geometry } from "geojson";

let cached: FeatureCollection<Geometry> | null = null;

export async function loadBoundaries(): Promise<FeatureCollection<Geometry>> {
  if (cached) return cached;

  const raw = await readFile(
    join(process.cwd(), "data/arrondissements.geojson"),
    "utf-8",
  );
  cached = JSON.parse(raw) as FeatureCollection<Geometry>;
  return cached;
}
