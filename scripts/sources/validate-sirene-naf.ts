import {
  SIRENE_NAF_BUCKETS,
  SIRENE_NAF_REV2_CODES,
  type SireneNightlifeBucket,
} from "./sirene-naf";

const NAF_CODE_PATTERN = /^\d{2}\.\d{2}[A-Z]$/;
const KNOWN_NAF_CODES = new Set<string>(SIRENE_NAF_REV2_CODES);

export type SireneNafValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateSireneNafBuckets(): SireneNafValidationResult {
  const errors: string[] = [];
  const seenCodeToBucket = new Map<string, SireneNightlifeBucket>();

  for (const [bucket, config] of Object.entries(SIRENE_NAF_BUCKETS) as Array<
    [SireneNightlifeBucket, (typeof SIRENE_NAF_BUCKETS)[SireneNightlifeBucket]]
  >) {
    if (config.codes.length === 0) {
      errors.push(`${bucket}: no NAF codes configured`);
      continue;
    }

    for (const code of config.codes) {
      if (!NAF_CODE_PATTERN.test(code)) {
        errors.push(`${bucket}: invalid code format "${code}"`);
      }

      if (!KNOWN_NAF_CODES.has(code)) {
        errors.push(`${bucket}: unknown/unapproved code "${code}"`);
      }

      const previousBucket = seenCodeToBucket.get(code);
      if (previousBucket) {
        errors.push(
          `${bucket}: duplicate code "${code}" already assigned to ${previousBucket}`,
        );
      } else {
        seenCodeToBucket.set(code, bucket);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidSireneNafBuckets(): void {
  const result = validateSireneNafBuckets();
  if (result.ok) return;

  throw new Error(
    `SIRENE NAF bucket validation failed:\n${result.errors
      .map((error) => `- ${error}`)
      .join("\n")}`,
  );
}
