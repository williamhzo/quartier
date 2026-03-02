import { setRequestLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { localeAlternates, localizeUrl, xDefaultUrl } from "@/lib/i18n-url";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { loadArrondissements } from "@/lib/data";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leaderboard" });
  const mt = await getTranslations({ locale, namespace: "metadata" });
  const description = mt("leaderboardDescription");
  const pathname = "/leaderboard";
  const languages = localeAlternates(pathname);
  languages["x-default"] = xDefaultUrl(pathname);
  const canonicalUrl = localizeUrl(pathname, locale);

  return {
    title: mt("leaderboardTitle"),
    description,
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      title: `${t("title")} - quartier`,
      description,
      url: canonicalUrl,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      siteName: "quartier",
      images: [{ url: "/api/og", width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${t("title")} - quartier`,
      description,
      images: ["/api/og"],
    },
  };
}

export default async function LeaderboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await loadArrondissements();

  return <LeaderboardPageContent data={data} />;
}

function LeaderboardPageContent({
  data,
}: {
  data: Awaited<ReturnType<typeof loadArrondissements>>;
}) {
  const t = useTranslations("leaderboard");

  return (
    <div className="mx-auto max-w-7xl px-4 pt-12 pb-8">
      <div className="mb-10">
        <h1 className="text-display text-4xl text-balance">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 text-base tracking-wide text-pretty">
          {t("description")}
        </p>
      </div>
      <LeaderboardTable data={data} />
    </div>
  );
}
