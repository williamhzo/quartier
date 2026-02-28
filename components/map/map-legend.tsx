"use client";

import { useTranslations } from "next-intl";
import type { DimensionKey } from "@/lib/types";
import { choroplethGradientCSS } from "./map-colors";

type Props = {
  dimension: DimensionKey | "composite";
  selectedScore?: number | null;
};

export function MapLegend({ dimension, selectedScore }: Props) {
  const t = useTranslations();
  const label = t(
    dimension === "composite"
      ? "dimensions.composite"
      : `dimensions.${dimension}`,
  );

  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-background/90 px-3 py-2 shadow-sm backdrop-blur-sm">
      <p className="text-foreground mb-1 text-xs font-medium">{label}</p>
      <div className="relative">
        <div
          className="h-2.5 w-36 rounded-full md:w-44"
          style={{ background: choroplethGradientCSS }}
        />
        {selectedScore != null && (
          <div
            className="absolute top-[-3px] size-4 -translate-x-1/2 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${Math.min(100, Math.max(0, selectedScore))}%` }}
          />
        )}
      </div>
      <div className="text-muted-foreground mt-0.5 flex w-36 justify-between text-[10px] md:w-44">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
