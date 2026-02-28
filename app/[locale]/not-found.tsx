import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("notFound");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="mt-2 text-balance text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-pretty text-sm">
        {t("description")}
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/">{t("backToMap")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/leaderboard">{t("backToLeaderboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
