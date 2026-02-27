import {
  DEFAULT_SIRENE_NIGHTLIFE_BUCKETS,
  getSireneNafCodes,
  type SireneNightlifeBucket,
} from "./sirene-naf";
import { assertValidSireneNafBuckets } from "./validate-sirene-naf";

export function isParisArrondissementCode(code: string): boolean {
  return /^751(0[1-9]|1\d|20)$/.test(code);
}

export function buildSireneApeFilter(
  buckets: readonly SireneNightlifeBucket[],
): string {
  const codes = getSireneNafCodes(buckets);

  if (codes.length === 0) {
    throw new Error("cannot build sirene ape filter: no naf codes resolved");
  }

  return codes
    .map((code) => `activitePrincipaleEtablissement:${code}`)
    .join(" OR ");
}

export function buildSireneNightlifeQuery(
  communeCode: string,
  buckets: readonly SireneNightlifeBucket[] = DEFAULT_SIRENE_NIGHTLIFE_BUCKETS,
): string {
  if (!isParisArrondissementCode(communeCode)) {
    throw new Error(`invalid paris arrondissement code: ${communeCode}`);
  }

  assertValidSireneNafBuckets();
  const apeFilter = buildSireneApeFilter(buckets);

  return `periode(etatAdministratifEtablissement:A AND (${apeFilter})) AND codeCommuneEtablissement:${communeCode}`;
}

export function buildSireneNightlifeSearchParams(
  communeCode: string,
  buckets?: readonly SireneNightlifeBucket[],
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("q", buildSireneNightlifeQuery(communeCode, buckets));
  return params;
}
