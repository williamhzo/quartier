import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/ingest/"],
    },
    sitemap: "https://quartier.sh/sitemap.xml",
  };
}
