import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MapPageContent />;
}

function MapPageContent() {
  const t = useTranslations("map");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="text-muted-foreground text-center">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2">{t("clickToExplore")}</p>
      </div>
    </div>
  );
}
