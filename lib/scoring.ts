import type { Arrondissement, DimensionKey, PersonaWeights } from "./types";

export function rankByDimension(
  arrondissements: Arrondissement[],
  key: DimensionKey,
): Map<number, { rank: number; score: number }> {
  const withScore = arrondissements
    .filter((a) => a.scores[key] != null)
    .map((a) => ({ number: a.number, score: a.scores[key]! }))
    .sort((a, b) => b.score - a.score);

  const result = new Map<number, { rank: number; score: number }>();
  withScore.forEach((a, i) => {
    result.set(a.number, { rank: i + 1, score: a.score });
  });
  return result;
}

export function dimensionMedian(
  arrondissements: Arrondissement[],
  key: DimensionKey,
): number | null {
  const scores = arrondissements
    .map((a) => a.scores[key])
    .filter((s): s is number => s != null)
    .sort((a, b) => a - b);

  if (scores.length === 0) return null;
  const mid = Math.floor(scores.length / 2);
  return scores.length % 2 === 0
    ? (scores[mid - 1] + scores[mid]) / 2
    : scores[mid];
}

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
