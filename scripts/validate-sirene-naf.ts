import { validateSireneNafBuckets } from "./sources/validate-sirene-naf";

const result = validateSireneNafBuckets();

if (result.ok) {
  console.log("sirene naf validation passed");
  process.exit(0);
}

console.error("sirene naf validation failed");
for (const error of result.errors) {
  console.error(`- ${error}`);
}

process.exit(1);
