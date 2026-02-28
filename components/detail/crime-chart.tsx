"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type Props = {
  categories: Record<string, number>;
};

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

const chartConfig = {
  value: {
    label: "Cases",
    color: "var(--color-muted-foreground)",
  },
} satisfies ChartConfig;

export function CrimeChart({ categories }: Props) {
  const t = useTranslations("detail");

  const data = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({
      name: truncate(name, 25),
      value,
    }));

  if (data.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground text-sm font-medium">
        {t("crimeBreakdown")}
      </h3>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[300px] w-full"
      >
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value) =>
                  `${Number(value).toLocaleString("fr-FR")} ${t("cases")}`
                }
              />
            }
          />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
