import type { Arrondissement, DimensionKey, PersonaWeights } from "./types";

export function computeComposite(
  scores: Record<DimensionKey, number | null>,
  weights: PersonaWeights,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of Object.keys(weights) as DimensionKey[]) {
    const score = scores[key];
    if (score == null) continue;

    const w = weights[key];
    weightedSum += w * score;
    totalWeight += w;
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

export function rankByComposite(
  arrondissements: Arrondissement[],
  weights: PersonaWeights,
): (Arrondissement & { composite: number; rank: number })[] {
  const withComposite = arrondissements.map((a) => ({
    ...a,
    composite: computeComposite(a.scores, weights),
    rank: 0,
  }));

  withComposite.sort((a, b) => b.composite - a.composite);
  withComposite.forEach((a, i) => {
    a.rank = i + 1;
  });

  return withComposite;
}
