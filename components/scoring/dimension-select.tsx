"use client";

import { useTranslations } from "next-intl";
import {
  SlidersHorizontal,
  Home,
  Wallet,
  Shield,
  TrainFront,
  Moon,
  TreePine,
  Volume2,
  Store,
  Palette,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { DimensionKey } from "@/lib/types";
import { DIMENSION_KEYS } from "@/lib/arrondissements";

type DimensionValue = DimensionKey | "composite";

const DIMENSION_ICONS: Record<DimensionValue, LucideIcon> = {
  composite: SlidersHorizontal,
  housing: Home,
  income: Wallet,
  safety: Shield,
  transport: TrainFront,
  nightlife: Moon,
  greenSpace: TreePine,
  noise: Volume2,
  amenities: Store,
  culture: Palette,
  sports: Dumbbell,
};

const ALL_VALUES: DimensionValue[] = ["composite", ...DIMENSION_KEYS];

type Props = {
  value: DimensionValue;
  onChange: (value: DimensionValue) => void;
};

export function DimensionSelect({ value, onChange }: Props) {
  const t = useTranslations("dimensions");

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium backdrop-blur-sm transition-colors",
          "bg-background/80 text-muted-foreground border-border/60",
          "data-[state=open]:bg-foreground data-[state=open]:text-background data-[state=open]:border-transparent",
        )}
      >
        {(() => {
          const Icon = DIMENSION_ICONS[value];
          return <Icon className="size-3" />;
        })()}
        {t(value)}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-auto">
        <div className="flex flex-col items-start gap-1">
          {ALL_VALUES.map((key) => (
            <Chip
              key={key}
              icon={DIMENSION_ICONS[key]}
              label={t(key)}
              active={key === value}
              onClick={() => onChange(key)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Chip({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background border-transparent"
          : "bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted border-border/60 backdrop-blur-sm",
      )}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}
