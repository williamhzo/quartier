"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("localeSwitcher");

  function switchLocale(nextLocale: string) {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="flex items-center gap-1">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={`rounded px-2 py-1 text-sm transition-colors ${
            locale === l
              ? "bg-secondary text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
