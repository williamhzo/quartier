import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { loadArrondissements } from "@/lib/data";
import { loadBoundaries, loadSeine } from "@/lib/geo";
import { DIMENSION_KEYS, formatArrondissement } from "@/lib/arrondissements";
import { EQUAL_WEIGHTS } from "@/lib/personas";
import {
  computeComposite,
  rankByComposite,
  rankByDimension,
  dimensionMedian,
} from "@/lib/scoring";
import { Badge } from "@/components/ui/badge";
import { DimensionSection } from "@/components/detail/dimension-section";
import { MiniMap } from "@/components/detail/mini-map";
import { Link } from "@/i18n/navigation";
import { ScoreOverview } from "@/components/detail/score-overview";
import { ShareButton } from "@/components/share-button";
import { ArrowLeft } from "lucide-react";

const VALID_NUMBERS = Array.from({ length: 20 }, (_, i) => String(i + 1));

type Props = {
  params: Promise<{ locale: string; number: string }>;
};

export function generateStaticParams() {
  return VALID_NUMBERS.map((number) => ({ number }));
}

export async function generateMetadata({ params }: Props) {
  const { locale, number } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const label = formatArrondissement(Number(number));
  const title = `${label} - ${t("title")}`;
  const ogImage = `/api/og/${number}`;

  return {
    title,
    openGraph: {
      title,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImage],
    },
  };
}

export default async function DetailPage({ params }: Props) {
  const { locale, number } = await params;
  if (!VALID_NUMBERS.includes(number)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const [data, boundaries, seine] = await Promise.all([
    loadArrondissements(),
    loadBoundaries(),
    loadSeine(),
  ]);
  const arrondissement = data.find((a) => a.number === Number(number));

  if (!arrondissement) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          {t("detail.backToMap")}
        </Link>
        <h1 className="mt-4 text-balance text-2xl font-semibold">
          {formatArrondissement(Number(number))}
        </h1>
        <p className="text-muted-foreground mt-2">{t("common.na")}</p>
      </div>
    );
  }

  const ranked = rankByComposite(data, EQUAL_WEIGHTS);
  const rank = ranked.find((a) => a.number === Number(number))?.rank ?? 0;
  const composite = computeComposite(arrondissement.scores, EQUAL_WEIGHTS);

  const feature = boundaries.features.find(
    (f) => f.properties?.number === arrondissement.number,
  );
  const geomXY = feature?.properties?.geom_x_y as
    | { lon: number; lat: number }
    | undefined;
  const center = geomXY
    ? { longitude: geomXY.lon, latitude: geomXY.lat }
    : { longitude: 2.3488, latitude: 48.8566 };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 pb-10">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        {t("detail.backToMap")}
      </Link>
      <h1 className="text-display mt-4 text-balance text-4xl sm:text-5xl">
        {formatArrondissement(arrondissement.number)}
      </h1>
      <div className="mt-3 flex items-center gap-3">
        <Badge variant="secondary" className="text-base">
          {Math.round(composite)}/100
        </Badge>
        <span className="text-muted-foreground text-sm tabular-nums">
          #{rank}/20
        </span>
        <ShareButton number={arrondissement.number} />
      </div>
      <div className="mt-8">
        <MiniMap
          boundaries={boundaries}
          seine={seine}
          highlightNumber={arrondissement.number}
          center={center}
        />
      </div>
      <div className="mt-12">
        <h2 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-widest">
          {t("detail.scoreOverview")}
        </h2>
        <ScoreOverview
          allArrondissements={data}
          currentNumber={arrondissement.number}
          scores={arrondissement.scores}
        />
      </div>
      <div className="mt-14 space-y-0">
        {[...DIMENSION_KEYS]
          .sort((a, b) => {
            const aNull = arrondissement.scores[a] == null ? 1 : 0;
            const bNull = arrondissement.scores[b] == null ? 1 : 0;
            return aNull - bNull;
          })
          .map((key) => {
            const dimRanks = rankByDimension(data, key);
            const dimMedian = dimensionMedian(data, key);
            const entry = dimRanks.get(arrondissement.number);
            return (
              <DimensionSection
                key={key}
                dimensionKey={key}
                arrondissement={arrondissement}
                rank={entry?.rank}
                total={dimRanks.size}
                median={dimMedian}
                variant="section"
              />
            );
          })}
      </div>
    </div>
  );
}
