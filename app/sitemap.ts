import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE_URL = "https://quartier.sh";

const ARRONDISSEMENTS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    // home (map)
    entries.push({
      url: `${BASE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${BASE_URL}/${l}`]),
        ),
      },
    });

    // leaderboard
    entries.push({
      url: `${BASE_URL}/${locale}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${BASE_URL}/${l}/leaderboard`]),
        ),
      },
    });

    // arrondissement detail pages
    for (const num of ARRONDISSEMENTS) {
      entries.push({
        url: `${BASE_URL}/${locale}/paris/${num}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [l, `${BASE_URL}/${l}/paris/${num}`]),
          ),
        },
      });
    }
  }

  return entries;
}
