"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DIMENSION_KEYS } from "@/lib/arrondissements";
import { rankByDimension, dimensionMedian } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import type { Arrondissement, DimensionKey } from "@/lib/types";

type Props = {
  allArrondissements: Arrondissement[];
  currentNumber: number;
  scores: Record<DimensionKey, number | null>;
};

export function ScoreOverview({
  allArrondissements,
  currentNumber,
  scores,
}: Props) {
  const t = useTranslations();

  const rows = useMemo(() => {
    return DIMENSION_KEYS.filter((key) => scores[key] != null).map((key) => {
      const ranks = rankByDimension(allArrondissements, key);
      const median = dimensionMedian(allArrondissements, key);
      const current = ranks.get(currentNumber);
      const allScores = allArrondissements
        .map((a) => a.scores[key])
        .filter((s): s is number => s != null);
      return {
        key,
        score: scores[key]!,
        rank: current?.rank ?? 0,
        total: allScores.length,
        median,
        allScores,
      };
    });
  }, [allArrondissements, currentNumber, scores]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <DotStripRow
          key={row.key}
          label={t(`dimensions.${row.key}`)}
          score={row.score}
          rank={row.rank}
          total={row.total}
          median={row.median}
          allScores={row.allScores}
        />
      ))}
    </div>
  );
}

function DotStripRow({
  label,
  score,
  rank,
  total,
  median,
  allScores,
}: {
  label: string;
  score: number;
  rank: number;
  total: number;
  median: number | null;
  allScores: number[];
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-20 shrink-0 truncate text-xs">
        {label}
      </span>
      <div className="relative h-4 min-w-0 flex-1">
        {allScores.map((s, i) => (
          <div
            key={i}
            className="bg-muted-foreground/20 absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full"
            style={{ left: `${s}%` }}
          />
        ))}
        {median != null && (
          <div
            className="absolute top-0 h-full w-px border-l border-dashed border-foreground/20"
            style={{ left: `${median}%` }}
          />
        )}
        <div
          className="bg-primary absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
          style={{ left: `${score}%` }}
        />
      </div>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        #{rank}
      </span>
    </div>
  );
}
