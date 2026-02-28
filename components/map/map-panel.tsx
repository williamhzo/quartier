"use client";

import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ShareButton } from "@/components/share-button";
import { ArrondissementLabel } from "@/components/arrondissement-label";
import { ScoreBar } from "@/components/detail/score-bar";
import { ScoreOverview } from "@/components/detail/score-overview";
import { DimensionSection } from "@/components/detail/dimension-section";
import { DIMENSION_KEYS } from "@/lib/arrondissements";
import { rankByDimension, dimensionMedian } from "@/lib/scoring";
import { Link } from "@/i18n/navigation";
import type { Arrondissement, DimensionKey } from "@/lib/types";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type Props = {
  arrondissement: Arrondissement & { composite: number; rank: number };
  allArrondissements: Arrondissement[];
  composite: number;
  rank: number;
  open: boolean;
  onClose: () => void;
};

export function MapPanel({ arrondissement, allArrondissements, composite, rank, open, onClose }: Props) {
  const num = arrondissement.number;

  return (
    <>
      {/* Desktop: side panel */}
      {open && (
        <div className="bg-background motion-safe:animate-in motion-safe:slide-in-from-right-full absolute top-0 right-0 z-20 hidden h-full overflow-y-auto border-l shadow-lg md:block md:w-[40vw] md:max-w-lg">
          <PanelContent
            num={num}
            composite={composite}
            rank={rank}
            arrondissement={arrondissement}
            allArrondissements={allArrondissements}
            onClose={onClose}
          />
        </div>
      )}

      {/* Mobile: vaul drawer with swipe-to-dismiss */}
      <Drawer
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
        modal={false}
      >
        <DrawerContent className="max-h-[80vh] pb-[env(safe-area-inset-bottom)] md:hidden">
          <VisuallyHidden>
            <DrawerTitle>
              <ArrondissementLabel number={num} locale="fr" />
            </DrawerTitle>
          </VisuallyHidden>
          <div className="overflow-y-auto overscroll-contain">
            <PanelContent
              num={num}
              composite={composite}
              rank={rank}
              arrondissement={arrondissement}
              allArrondissements={allArrondissements}
              onClose={onClose}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function PanelContent({
  num,
  composite,
  rank,
  arrondissement,
  allArrondissements,
  onClose,
}: {
  num: number;
  composite: number;
  rank: number;
  arrondissement: Arrondissement;
  allArrondissements: Arrondissement[];
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="p-5">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-display text-balance text-2xl">
            <ArrondissementLabel number={num} locale={locale} />
          </h2>
          <p className="text-muted-foreground/70 font-mono text-xs tabular-nums">
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

      <div className="mb-6">
        <ScoreBar
          label={t("dimensions.composite")}
          score={Math.round(composite)}
        />
      </div>

      <div className="mb-6">
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {t("detail.scoreOverview")}
        </h3>
        <ScoreOverview
          allArrondissements={allArrondissements}
          currentNumber={arrondissement.number}
          scores={arrondissement.scores}
        />
      </div>

      <div className="space-y-4">
        {[...DIMENSION_KEYS]
          .sort((a, b) => {
            const aNull = arrondissement.scores[a] == null ? 1 : 0;
            const bNull = arrondissement.scores[b] == null ? 1 : 0;
            return aNull - bNull;
          })
          .map((key) => {
            const dimRanks = rankByDimension(allArrondissements, key as DimensionKey);
            const dimMedian = dimensionMedian(allArrondissements, key as DimensionKey);
            const entry = dimRanks.get(arrondissement.number);
            return (
              <DimensionSection
                key={key}
                dimensionKey={key as DimensionKey}
                arrondissement={arrondissement}
                rank={entry?.rank}
                total={dimRanks.size}
                median={dimMedian}
                compact
              />
            );
          })}
      </div>

      <div className="mt-4 border-t pt-4">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/paris/${num}`}>
            {t("detail.viewFull")}
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
