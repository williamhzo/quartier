import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Nav } from "@/components/layout/nav";
import "../globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((l) => [l, `https://quartier.sh/${l}`]),
  );
  languages["x-default"] = `https://quartier.sh/${routing.defaultLocale}`;

  return {
    metadataBase: new URL("https://quartier.sh"),
    title: {
      default: t("title"),
      template: `%s - quartier`,
    },
    description: t("description"),
    alternates: {
      canonical: `https://quartier.sh/${locale}`,
      languages,
    },
    openGraph: {
      type: "website",
      siteName: "quartier",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      title: t("title"),
      description: t("description"),
      url: `https://quartier.sh/${locale}`,
      images: [{ url: "/api/og", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/api/og"],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    applicationCategory: "Reference",
    name: "quartier",
    url: `https://quartier.sh/${locale}`,
    inLanguage: locale === "fr" ? "fr-FR" : "en-US",
    description:
      locale === "fr"
        ? "Comparez les 20 arrondissements de Paris : logement, revenus, sécurité, transports, vie nocturne, espaces verts, bruit, équipements, culture et sport."
        : "Compare all 20 Paris arrondissements across housing, income, safety, transport, nightlife, green space, noise, amenities, culture, and sports.",
  };

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider>
          <NuqsAdapter>
            <Nav />
            <main>{children}</main>
          </NuqsAdapter>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
