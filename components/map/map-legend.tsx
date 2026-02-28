"use client";

import { useTranslations } from "next-intl";
import type { DimensionKey } from "@/lib/types";

const GRADIENT_STOPS = [
  { pct: 0, color: "#f7fbff" },
  { pct: 20, color: "#c6dbef" },
  { pct: 40, color: "#6baed6" },
  { pct: 60, color: "#2171b5" },
  { pct: 80, color: "#08519c" },
  { pct: 100, color: "#08306b" },
];

const gradient = `linear-gradient(to right, ${GRADIENT_STOPS.map(
  (s) => `${s.color} ${s.pct}%`,
).join(", ")})`;

type Props = {
  dimension: DimensionKey | "composite";
};

export function MapLegend({ dimension }: Props) {
  const t = useTranslations();
  const label = t(
    dimension === "composite"
      ? "dimensions.composite"
      : `dimensions.${dimension}`,
  );

  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-background/90 px-3 py-2 shadow-sm backdrop-blur-sm">
      <p className="text-foreground mb-1 text-xs font-medium">{label}</p>
      <div
        className="h-2.5 w-36 rounded-sm"
        style={{ background: gradient }}
      />
      <div className="text-muted-foreground mt-0.5 flex justify-between text-[10px]">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}
