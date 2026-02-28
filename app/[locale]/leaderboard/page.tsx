import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { loadArrondissements } from "@/lib/data";

type Props = {
  params: Promise<{ locale: string }>;
};

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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-balance text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-pretty">{t("description")}</p>
      </div>
      <LeaderboardTable data={data} />
    </div>
  );
}
