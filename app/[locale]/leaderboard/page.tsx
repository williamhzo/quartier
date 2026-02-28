import { setRequestLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { loadArrondissements } from "@/lib/data";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leaderboard" });

  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `https://quartier.sh/${l}/leaderboard`]),
  );

  return {
    title: `${t("title")} - quartier`,
    description: t("description"),
    alternates: {
      canonical: `https://quartier.sh/${locale}/leaderboard`,
      languages,
    },
    openGraph: {
      title: `${t("title")} - quartier`,
      description: t("description"),
      url: `https://quartier.sh/${locale}/leaderboard`,
      images: [{ url: "/api/og", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${t("title")} - quartier`,
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
        <h1 className="text-display text-balance text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 text-base tracking-wide text-pretty">
          {t("description")}
        </p>
      </div>
      <LeaderboardTable data={data} />
    </div>
  );
}
