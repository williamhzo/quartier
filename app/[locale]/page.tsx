import { setRequestLocale } from "next-intl/server";
import { loadArrondissements } from "@/lib/data";
import { loadBoundaries, loadContextBoundaries } from "@/lib/geo";
import { ParisMap } from "@/components/map/paris-map";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [arrondissements, boundaries, contextBoundaries] = await Promise.all([
    loadArrondissements(),
    loadBoundaries(),
    loadContextBoundaries(),
  ]);

  return (
    <ParisMap
      arrondissements={arrondissements}
      boundaries={boundaries}
      contextBoundaries={contextBoundaries}
    />
  );
}
