"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { AboutDialog } from "./about-dialog";

export function Nav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const links = [
    { href: "/" as const, label: t("map") },
    { href: "/leaderboard" as const, label: t("leaderboard") },
  ];

  return (
    <nav className="flex h-14 items-center justify-between border-b border-border/40 px-3 md:px-4">
      <div className="flex items-center gap-3 md:gap-6">
        <Link href="/" className="flex items-baseline gap-0.5 text-lg font-semibold tracking-[-0.04em]">
          {t("title")}
          <span className="text-muted-foreground font-mono text-sm">.sh</span>
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm tracking-wide transition-colors ${
                pathname === link.href
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <AboutDialog>
            <button className="text-muted-foreground hover:text-foreground cursor-pointer text-sm tracking-wide transition-colors">
              <Info className="size-4 md:hidden" />
              <span className="hidden md:inline">{t("about")}</span>
            </button>
          </AboutDialog>
        </div>
      </div>
      <LocaleSwitcher />
    </nav>
  );
}
