"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DimensionKey } from "@/lib/types";
import { DIMENSION_KEYS } from "@/lib/arrondissements";

type DimensionValue = DimensionKey | "composite";

const ALL_VALUES: DimensionValue[] = ["composite", ...DIMENSION_KEYS];

type Props = {
  value: DimensionValue;
  onChange: (value: DimensionValue) => void;
};

export function DimensionSelect({ value, onChange }: Props) {
  const t = useTranslations("dimensions");

  return (
    <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ALL_VALUES.map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            key === value
              ? "bg-foreground text-background border-transparent"
              : "bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted border-border/60 backdrop-blur-sm",
          )}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
