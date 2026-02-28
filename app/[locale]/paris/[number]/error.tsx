"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorCard } from "@/components/error-card";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DetailError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = useTranslations("nav");

  return (
    <ErrorCard reset={reset} backHref="/leaderboard" backLabel={t("leaderboard")} />
  );
}
