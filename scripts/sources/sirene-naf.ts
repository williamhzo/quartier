export type SireneNightlifeBucket =
  | "restaurants"
  | "bars_cafes"
  | "nightlife_extension";

export type SireneNafBucketConfig = {
  codes: readonly string[];
  description: string;
  enabledByDefault: boolean;
};

export const SIRENE_NAF_REV2_CODES = [
  "56.10A",
  "56.10B",
  "56.10C",
  "56.30Z",
  "93.29Z",
] as const;

export const SIRENE_NAF_BUCKETS: Record<
  SireneNightlifeBucket,
  SireneNafBucketConfig
> = {
  restaurants: {
    codes: ["56.10A", "56.10B", "56.10C"],
    description:
      "Restauration traditionnelle, cafeterias/libre-service, restauration rapide",
    enabledByDefault: true,
  },
  bars_cafes: {
    codes: ["56.30Z"],
    description: "Debits de boissons (incl. cafes)",
    enabledByDefault: true,
  },
  nightlife_extension: {
    codes: ["93.29Z"],
    description: "Autres activites recreatives (extension optionnelle)",
    enabledByDefault: false,
  },
};

export const DEFAULT_SIRENE_NIGHTLIFE_BUCKETS = (
  Object.entries(SIRENE_NAF_BUCKETS) as Array<
    [SireneNightlifeBucket, SireneNafBucketConfig]
  >
)
  .filter(([, config]) => config.enabledByDefault)
  .map(([bucket]) => bucket);

export function getSireneNafCodes(
  buckets: readonly SireneNightlifeBucket[],
): string[] {
  const codes = new Set<string>();

  for (const bucket of buckets) {
    for (const code of SIRENE_NAF_BUCKETS[bucket].codes) {
      codes.add(code);
    }
  }

  return [...codes];
}
