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
  const charLimit = compact ? 28 : 32;

  const data = Object.entries(items)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxItems)
    .map(([name, value]) => ({
      name: truncate(name, charLimit),
      fullName: name,
      value,
    }));

  if (data.length === 0) return null;

  const fullNameMap = new Map(data.map((d) => [d.name, d.fullName]));
  const height = compact
    ? Math.max(120, data.length * 28)
    : Math.max(160, data.length * 36);

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
            width={compact ? 150 : 180}
            tick={(props) => (
              <TickWithTitle
                {...props}
                compact={compact}
                fullNameMap={fullNameMap}
              />
            )}
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

function TickWithTitle({
  x,
  y,
  payload,
  compact,
  fullNameMap,
}: {
  x: number;
  y: number;
  payload: { value: string };
  compact?: boolean;
  fullNameMap: Map<string, string>;
}) {
  const fullName = fullNameMap.get(payload.value) ?? payload.value;
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="central"
      fontSize={compact ? 10 : 11}
      fill="currentColor"
      className="text-muted-foreground"
    >
      <title>{fullName}</title>
      {payload.value}
    </text>
  );
}
