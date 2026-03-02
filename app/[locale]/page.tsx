import { setRequestLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { localeAlternates, localizeUrl, xDefaultUrl } from "@/lib/i18n-url";
import { searchParamsCache } from "@/lib/search-params";
import { arrondissementName } from "@/lib/arrondissements";
import { loadArrondissements } from "@/lib/data";
import { loadBoundaries, loadContextBoundaries, loadSeine } from "@/lib/geo";
import { ParisMap } from "@/components/map/paris-map";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale } = await params;
  const { arr } = await searchParamsCache.parse(searchParams);
  const t = await getTranslations({ locale, namespace: "metadata" });
  const languages = localeAlternates("/");
  languages["x-default"] = xDefaultUrl("/");
  const canonicalUrl = localizeUrl("/", locale);

  if (arr != null && arr >= 1 && arr <= 20) {
    const name = arrondissementName(arr, locale);
    const title = `${name} - quartier`;
    return {
      title: { absolute: title },
      alternates: { canonical: canonicalUrl, languages },
      openGraph: {
        title,
        description: t("description"),
        url: canonicalUrl,
        locale: locale === "fr" ? "fr_FR" : "en_US",
        siteName: "quartier",
        images: [{ url: `/api/og/${arr}`, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image" as const,
        title,
        description: t("description"),
        images: [`/api/og/${arr}`],
      },
    };
  }

  return {
    alternates: { canonical: canonicalUrl, languages },
  };
}

export default async function MapPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await searchParamsCache.parse(searchParams);

  const t = await getTranslations({ locale, namespace: "map" });
  const [arrondissements, boundaries, contextBoundaries, seine] =
    await Promise.all([
      loadArrondissements(),
      loadBoundaries(),
      loadContextBoundaries(),
      loadSeine(),
    ]);

  return (
    <>
      <h1 className="sr-only">{t("h1")}</h1>
      <ParisMap
        arrondissements={arrondissements}
        boundaries={boundaries}
        contextBoundaries={contextBoundaries}
        seine={seine}
      />
    </>
  );
}
