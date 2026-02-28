"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { ScoreBar } from "@/components/detail/score-bar";
import { ScoreRadar } from "@/components/detail/score-radar";
import { DimensionSection } from "@/components/detail/dimension-section";
import { DIMENSION_KEYS, formatArrondissement } from "@/lib/arrondissements";
import type { Arrondissement, DimensionKey } from "@/lib/types";

type Props = {
  arrondissement: Arrondissement & { composite: number; rank: number };
  composite: number;
  rank: number;
  onClose: () => void;
};

export function MapPanel({ arrondissement, composite, rank, onClose }: Props) {
  const num = arrondissement.number;
  const label = formatArrondissement(num);

  return (
    <>
      {/* Desktop: side panel */}
      <div className="bg-background motion-safe:animate-in motion-safe:slide-in-from-right-full absolute top-0 right-0 z-20 hidden h-full overflow-y-auto border-l shadow-lg md:block md:w-96 lg:w-[28rem]">
        <PanelContent
          label={label}
          num={num}
          composite={composite}
          rank={rank}
          arrondissement={arrondissement}
          onClose={onClose}
        />
      </div>

      {/* Mobile: bottom sheet */}
      <div className="bg-background motion-safe:animate-in motion-safe:slide-in-from-bottom-full absolute right-0 bottom-0 left-0 z-20 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] shadow-lg md:hidden">
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1">
          <div className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
        </div>
        <PanelContent
          label={label}
          num={num}
          composite={composite}
          rank={rank}
          arrondissement={arrondissement}
          onClose={onClose}
        />
      </div>
    </>
  );
}

function PanelContent({
  label,
  num,
  composite,
  rank,
  arrondissement,
  onClose,
}: {
  label: string;
  num: number;
  composite: number;
  rank: number;
  arrondissement: Arrondissement;
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-balance text-lg font-semibold">{label}</h2>
          <p className="text-muted-foreground text-sm tabular-nums">
            {t("detail.rank")}: {rank} {t("detail.outOf")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ShareButton number={num} size="icon-xs" />
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label={t("common.close")}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <ScoreBar
          label={t("dimensions.composite")}
          score={Math.round(composite)}
        />
      </div>

      <div className="mb-4">
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {t("detail.scoreOverview")}
        </h3>
        <ScoreRadar scores={arrondissement.scores} />
      </div>

      <div className="space-y-3">
        {DIMENSION_KEYS.map((key) => (
          <DimensionSection
            key={key}
            dimensionKey={key as DimensionKey}
            arrondissement={arrondissement}
          />
        ))}
      </div>
    </div>
  );
}
