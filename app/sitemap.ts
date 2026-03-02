import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { localeAlternates, localizeUrl } from "@/lib/i18n-url";

const ARRONDISSEMENTS = Array.from({ length: 20 }, (_, i) => i + 1);

const LAST_MODIFIED = new Date("2026-03-02");

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    const homePath = "/";
    entries.push({
      url: localizeUrl(homePath, locale),
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: localeAlternates(homePath),
      },
    });

    const leaderboardPath = "/leaderboard";
    entries.push({
      url: localizeUrl(leaderboardPath, locale),
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: localeAlternates(leaderboardPath),
      },
    });

    for (const num of ARRONDISSEMENTS) {
      const detailPath = `/paris/${num}`;
      entries.push({
        url: localizeUrl(detailPath, locale),
        lastModified: LAST_MODIFIED,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: {
          languages: localeAlternates(detailPath),
        },
      });
    }
  }

  return entries;
}
