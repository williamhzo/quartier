import { setRequestLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { routing } from "@/i18n/routing";
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

  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `https://quartier.sh/${l}`]),
  );

  if (arr != null && arr >= 1 && arr <= 20) {
    const name = arrondissementName(arr, locale);
    const title = `${name} - quartier`;
    return {
      title,
      alternates: { canonical: `https://quartier.sh/${locale}`, languages },
      openGraph: {
        title,
        description: t("description"),
        url: `https://quartier.sh/${locale}`,
        images: [{ url: `/api/og/${arr}`, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image" as const,
        title,
        images: [`/api/og/${arr}`],
      },
    };
  }

  return {
    alternates: { canonical: `https://quartier.sh/${locale}`, languages },
  };
}

export default async function MapPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await searchParamsCache.parse(searchParams);

  const [arrondissements, boundaries, contextBoundaries, seine] =
    await Promise.all([
      loadArrondissements(),
      loadBoundaries(),
      loadContextBoundaries(),
      loadSeine(),
    ]);

  return (
    <ParisMap
      arrondissements={arrondissements}
      boundaries={boundaries}
      contextBoundaries={contextBoundaries}
      seine={seine}
    />
  );
}
