"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ScoreBar } from "@/components/detail/score-bar";
import { DIMENSION_KEYS, formatArrondissement } from "@/lib/arrondissements";
import type { Arrondissement, DimensionKey, PersonaWeights } from "@/lib/types";

type Props = {
  arrondissement: Arrondissement & { composite: number; rank: number };
  composite: number;
  rank: number;
  weights: PersonaWeights;
  onClose: () => void;
};

export function MapPanel({
  arrondissement,
  composite,
  rank,
  weights,
  onClose,
}: Props) {
  const num = arrondissement.number;
  const label = formatArrondissement(num);

  const activeDimensions = DIMENSION_KEYS.filter(
    (k) => weights[k as DimensionKey] > 0,
  );

  return (
    <>
      {/* Desktop: side panel */}
      <div className="bg-background animate-in slide-in-from-right-full absolute top-0 right-0 z-20 hidden h-full w-80 overflow-y-auto border-l shadow-lg md:block">
        <PanelContent
          label={label}
          num={num}
          composite={composite}
          rank={rank}
          activeDimensions={activeDimensions}
          arrondissement={arrondissement}
          onClose={onClose}
        />
      </div>

      {/* Mobile: bottom sheet */}
      <div className="bg-background animate-in slide-in-from-bottom-full absolute right-0 bottom-0 left-0 z-20 max-h-[60vh] overflow-y-auto rounded-t-xl border-t shadow-lg md:hidden">
        <PanelContent
          label={label}
          num={num}
          composite={composite}
          rank={rank}
          activeDimensions={activeDimensions}
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
  activeDimensions,
  arrondissement,
  onClose,
}: {
  label: string;
  num: number;
  composite: number;
  rank: number;
  activeDimensions: readonly string[];
  arrondissement: Arrondissement;
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{label}</h2>
          <p className="text-muted-foreground text-sm">
            {t("detail.rank")}: {rank} {t("detail.outOf")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-md p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4">
        <ScoreBar
          label={t("dimensions.composite")}
          score={Math.round(composite)}
        />
      </div>

      <div className="space-y-2">
        {activeDimensions.map((key) => {
          const score = arrondissement.scores[key as DimensionKey];
          return (
            <ScoreBar
              key={key}
              label={t(`dimensions.${key}`)}
              score={score != null ? Math.round(score) : null}
            />
          );
        })}
      </div>

      <div className="mt-4">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/paris/${num}`}>{t("detail.viewDetails")}</Link>
        </Button>
      </div>
    </div>
  );
}
