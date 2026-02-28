"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";

export function ShareButton({
  number,
  size = "icon-sm",
}: {
  number: number;
  size?: "icon-xs" | "icon-sm" | "icon";
}) {
  const t = useTranslations("detail");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/paris/${number}`;
    navigator.clipboard.writeText(url).then(() => {
      posthog.capture("share_link_copied", {
        arrondissement_number: number,
      });
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
      {copied ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
    </Button>
  );
}
