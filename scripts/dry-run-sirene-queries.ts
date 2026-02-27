import {
  DATA_CONFIG,
  PARIS_ARRONDISSEMENT_COMMUNES,
  getEnabledSireneBuckets,
} from "./data-config";
import { buildSireneNightlifeSearchParams } from "./sources/sirene-query";

type CliOptions = {
  all: boolean;
  commune: string | null;
};

function parseOptions(argv: string[]): CliOptions {
  let all = false;
  let commune: string | null = null;

  for (const arg of argv) {
    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg.startsWith("--commune=")) {
      commune = arg.slice("--commune=".length);
      continue;
    }
  }

  return { all, commune };
}

function resolveCommunes(options: CliOptions): string[] {
  if (options.commune) return [options.commune];
  if (options.all) return [...PARIS_ARRONDISSEMENT_COMMUNES];
  return ["75111"];
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const communes = resolveCommunes(options);
  const buckets = getEnabledSireneBuckets();

  console.log(`sirene api base: ${DATA_CONFIG.sources.sirene.baseUrl}`);
  console.log(`buckets: ${buckets.join(",")}`);
  console.log(`communes: ${communes.join(",")}`);
  console.log("");

  for (const commune of communes) {
    const params = buildSireneNightlifeSearchParams(commune, buckets);
    const url = `${DATA_CONFIG.sources.sirene.baseUrl}?${params.toString()}`;
    console.log(`${commune} ${url}`);
  }
}

main();
