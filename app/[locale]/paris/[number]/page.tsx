import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { loadArrondissements } from "@/lib/data";
import { loadBoundaries, loadSeine } from "@/lib/geo";
import { DIMENSION_KEYS, formatArrondissement } from "@/lib/arrondissements";
import { ArrondissementLabel } from "@/components/arrondissement-label";
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
import { localeAlternates, localizeUrl, xDefaultUrl } from "@/lib/i18n-url";
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
  const label = formatArrondissement(Number(number), locale);
  const description = t("detailDescription", { label });
  const ogImage = `/api/og/${number}`;
  const pathname = `/paris/${number}`;
  const languages = localeAlternates(pathname);
  languages["x-default"] = xDefaultUrl(pathname);
  const canonicalUrl = localizeUrl(pathname, locale);

  return {
    title: label,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      title: `${label} - quartier`,
      description,
      url: canonicalUrl,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      siteName: "quartier",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${label} - quartier`,
      description,
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
        <h1 className="mt-4 text-2xl font-semibold text-balance">
          <ArrondissementLabel number={Number(number)} locale={locale} />
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

  const label = formatArrondissement(arrondissement.number, locale);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "quartier",
        item: localizeUrl("/", locale),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: label,
        item: localizeUrl(`/paris/${arrondissement.number}`, locale),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        {t("detail.backToMap")}
      </Link>
      <h1 className="text-display mt-4 text-4xl text-balance sm:text-5xl">
        <ArrondissementLabel number={arrondissement.number} locale={locale} />
      </h1>
      <div className="mt-3 flex items-center gap-3">
        <Badge variant="secondary" className="font-mono text-base">
          {Math.round(composite)}/100
        </Badge>
        <span className="text-muted-foreground font-mono text-sm tabular-nums">
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
        <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
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
