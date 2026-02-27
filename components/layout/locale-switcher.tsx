"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(nextLocale: string) {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="flex items-center text-xs">
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="text-muted-foreground/50 mx-1">/</span>}
          {locale === l ? (
            <span className="text-foreground">{l.toUpperCase()}</span>
          ) : (
            <button
              onClick={() => switchLocale(l)}
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              {l.toUpperCase()}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
