"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

export function Nav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const links = [
    { href: "/" as const, label: t("map") },
    { href: "/leaderboard" as const, label: t("leaderboard") },
  ];

  return (
    <nav className="border-border flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {t("title")}
        </Link>
        <div className="flex items-center gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <LocaleSwitcher />
    </nav>
  );
}
