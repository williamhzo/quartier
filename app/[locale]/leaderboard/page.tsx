import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LeaderboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LeaderboardPageContent />;
}

function LeaderboardPageContent() {
  const t = useTranslations("leaderboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground mt-1">{t("description")}</p>
    </div>
  );
}
