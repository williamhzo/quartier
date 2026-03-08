"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function ShareButton({
  number,
  size = "icon-sm",
}: {
  number: number;
  size?: "icon-xs" | "icon-sm" | "icon";
}) {
  const t = useTranslations("detail");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const pathname =
      locale === routing.defaultLocale
        ? `/paris/${number}`
        : `/${locale}/paris/${number}`;
    const url = `${window.location.origin}${pathname}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleCopy}
      aria-label={copied ? t("copied") : t("share")}
    >
      {copied ? (
        <Check className="size-4" />
      ) : (
        <LinkIcon className="size-4" />
      )}
    </Button>
  );
}
