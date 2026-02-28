"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition-colors",
          open
            ? "bg-foreground text-background border-transparent"
            : "bg-background/80 text-muted-foreground border-border/60",
        )}
      >
        <SlidersHorizontal className="size-3" />
        {t(value)}
      </button>

      {open && (
        <div className="flex flex-col items-start gap-1">
          {ALL_VALUES.map((key) => (
            <Chip
              key={key}
              label={t(key)}
              active={key === value}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background border-transparent"
          : "bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted border-border/60 backdrop-blur-sm",
      )}
    >
      {label}
    </button>
  );
}
