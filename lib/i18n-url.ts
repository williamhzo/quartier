import { routing } from "@/i18n/routing";

export const SITE_URL = "https://quartier.sh";

function normalizePathname(pathname: string) {
  if (pathname === "/") return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function localizePathname(pathname: string, locale: string) {
  const normalized = normalizePathname(pathname);

  if (locale === routing.defaultLocale) {
    return normalized;
  }

  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

export function localizeUrl(pathname: string, locale: string) {
  return `${SITE_URL}${localizePathname(pathname, locale)}`;
}

export function localeAlternates(pathname: string) {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, localizeUrl(pathname, locale)]),
  );
}

export function xDefaultUrl(pathname: string) {
  return localizeUrl(pathname, routing.defaultLocale);
}
