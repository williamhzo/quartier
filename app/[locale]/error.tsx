"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = useTranslations("error");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        {t("description")}
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={reset}>
          {t("retry")}
        </Button>
        <Button asChild>
          <Link href="/">{t("backToMap")}</Link>
        </Button>
      </div>
    </div>
  );
}
