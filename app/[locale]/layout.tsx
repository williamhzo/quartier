import { Analytics } from "@vercel/analytics/next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { notFound } from "next/navigation";
import localFont from "next/font/local";
import { routing } from "@/i18n/routing";
import {
  localeAlternates,
  localizeUrl,
  SITE_URL,
  xDefaultUrl,
} from "@/lib/i18n-url";
import { Nav } from "@/components/layout/nav";
import "../globals.css";

const geistSans = localFont({
  src: [
    {
      path: "../../assets/fonts/Geist-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../assets/fonts/Geist-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../../assets/fonts/GeistMono-SemiBold.ttf",
  weight: "600",
  style: "normal",
  display: "swap",
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
  const languages = localeAlternates("/");
  languages["x-default"] = xDefaultUrl("/");
  const canonicalUrl = localizeUrl("/", locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("title"),
      template: `%s - Quartier`,
    },
    description: t("description"),
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      type: "website",
      siteName: "Quartier",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      title: t("title"),
      description: t("description"),
      url: canonicalUrl,
      images: [{ url: "/api/og", width: 1200, height: 630, type: "image/png" }],
    },
    formatDetection: { telephone: false, email: false, address: false },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
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

  const t = await getTranslations({ locale, namespace: "metadata" });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    applicationCategory: "Reference",
    name: "Quartier",
    url: localizeUrl("/", locale),
    inLanguage: locale === "fr" ? "fr-FR" : "en-US",
    description: t("description"),
  };

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\u003c"),
          }}
        />
        <NextIntlClientProvider>
          <NuqsAdapter>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
            >
              {t("skipToContent")}
            </a>
            <Nav />
            <main id="main">{children}</main>
          </NuqsAdapter>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
