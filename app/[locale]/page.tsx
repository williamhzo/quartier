import { setRequestLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { searchParamsCache } from "@/lib/search-params";
import { ARRONDISSEMENT_NAMES } from "@/lib/arrondissements";
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

  if (arr != null && arr >= 1 && arr <= 20) {
    const name = ARRONDISSEMENT_NAMES[arr];
    const title = `${name} - quartier`;
    return {
      title,
      openGraph: {
        title,
        description: t("description"),
        images: [{ url: `/api/og/${arr}`, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image" as const,
        title,
        images: [`/api/og/${arr}`],
      },
    };
  }

  return {};
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
