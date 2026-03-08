import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quartier",
    short_name: "Quartier",
    description:
      "Compare all 20 Paris arrondissements across housing, income, safety, transport, nightlife, green space, noise, amenities, culture, and sports.",
    start_url: "/",
    display: "browser",
    background_color: "#fafafa",
    theme_color: "#0a0a0a",
  };
}
