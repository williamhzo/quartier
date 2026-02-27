import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DATA_CONFIG,
  PARIS_ARRONDISSEMENT_COMMUNES,
  getEnabledSireneBuckets,
} from "./data-config";
import { fetchSireneNightlifeSnapshot } from "./sources/sirene";

type RefreshOptions = {
  dimensions: string[];
  commune: string | null;
  all: boolean;
  offline: boolean;
  outPath: string;
};

function parseOptions(argv: string[]): RefreshOptions {
  let dimensions: string[] = [];
  let commune: string | null = null;
  let all = false;
  let offline = false;
  let outPath = path.join(
    process.cwd(),
    "data",
    "raw",
    "sirene",
    "nightlife-snapshots.json",
  );

  for (const arg of argv) {
    if (arg.startsWith("--dimensions=")) {
      dimensions = arg
        .slice("--dimensions=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    if (arg.startsWith("--commune=")) {
      commune = arg.slice("--commune=".length);
      continue;
    }

    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg === "--offline") {
      offline = true;
      continue;
    }

    if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
      continue;
    }
  }

  return { dimensions, commune, all, offline, outPath };
}

function resolveDimensions(input: string[]): Set<string> {
  if (input.length > 0) return new Set(input);
  return new Set(DATA_CONFIG.enabledDimensions);
}

function resolveCommunes(options: RefreshOptions): string[] {
  if (options.commune) return [options.commune];
  if (options.all) return [...PARIS_ARRONDISSEMENT_COMMUNES];
  return ["75111"];
}

async function refreshNightlife(options: RefreshOptions): Promise<void> {
  const communes = resolveCommunes(options);
  const buckets = getEnabledSireneBuckets();
  const mode = options.offline ? "cache-only" : "network-first";
  const accessToken = process.env.SIRENE_API_TOKEN ?? "";

  if (mode === "network-first" && accessToken.length === 0) {
    throw new Error("SIRENE_API_TOKEN is required for online nightlife refresh");
  }

  const snapshots = [];
  for (const communeCode of communes) {
    const snapshot = await fetchSireneNightlifeSnapshot({
      communeCode,
      accessToken,
      buckets,
      mode,
      expectedNomenclatures: DATA_CONFIG.sources.sirene.expectedNomenclatures,
    });
    snapshots.push(snapshot);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    mode,
    dimensions: ["nightlife"],
    communes,
    buckets,
    expectedNomenclatures: DATA_CONFIG.sources.sirene.expectedNomenclatures,
    snapshots,
  };

  await mkdir(path.dirname(options.outPath), { recursive: true });
  await writeFile(options.outPath, JSON.stringify(payload, null, 2));

  console.log(`wrote nightlife snapshots: ${options.outPath}`);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const dimensions = resolveDimensions(options.dimensions);

  if (!dimensions.has("nightlife")) {
    console.log("nothing to do: nightlife not in --dimensions");
    return;
  }

  await refreshNightlife(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
