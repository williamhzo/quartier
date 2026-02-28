"use client";

import { useTranslations } from "next-intl";
import type { DimensionKey } from "@/lib/types";
import { choroplethGradientCSS } from "./map-colors";

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
        style={{ background: choroplethGradientCSS }}
      />
      <div className="text-muted-foreground mt-0.5 flex justify-between text-[10px]">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}
