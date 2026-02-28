"use client";

import { useTranslations } from "next-intl";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { DIMENSION_KEYS } from "@/lib/arrondissements";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DimensionKey } from "@/lib/types";

type Props = {
  scores: Record<DimensionKey, number | null>;
};

const chartConfig = {
  score: {
    label: "Score",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

export function ScoreRadar({ scores }: Props) {
  const t = useTranslations("dimensions");

  const data = DIMENSION_KEYS.map((key) => ({
    dimension: t(key),
    score: scores[key] ?? 0,
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-auto h-[280px] w-full max-w-md"
    >
      <RadarChart data={data}>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel />}
          cursor={false}
        />
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
        <Radar
          dataKey="score"
          fill="var(--color-score)"
          fillOpacity={0.3}
          stroke="var(--color-score)"
        />
      </RadarChart>
    </ChartContainer>
  );
}
