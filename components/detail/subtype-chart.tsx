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
  items: Record<string, number>;
  maxItems?: number;
  compact?: boolean;
};

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

const chartConfig = {
  value: {
    label: "Count",
    color: "var(--color-muted-foreground)",
  },
} satisfies ChartConfig;

export function SubtypeChart({ items, maxItems = 8, compact }: Props) {
  const t = useTranslations("detail");

  const data = Object.entries(items)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxItems)
    .map(([name, value]) => ({
      name: truncate(name, compact ? 18 : 25),
      value,
    }));

  if (data.length === 0) return null;

  const height = compact ? Math.max(120, data.length * 24) : Math.max(160, data.length * 36);

  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground text-sm font-medium">
        {t("breakdown")}
      </h3>
      <ChartContainer
        config={chartConfig}
        className="w-full"
        style={{ height }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="name"
            width={compact ? 100 : 160}
            tick={{ fontSize: compact ? 10 : 11 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value) => Number(value).toLocaleString("fr-FR")}
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
