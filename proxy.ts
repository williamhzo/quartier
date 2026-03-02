import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const LOCALE_COOKIE = "NEXT_LOCALE";

function hasLocalePrefix(pathname: string) {
  return new RegExp(`^/(${routing.locales.join("|")})(/|$)`).test(pathname);
}

function toLocalePath(pathname: string, locale: string) {
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}

function getCountryCode(request: NextRequest) {
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry");
  return country?.toUpperCase() ?? null;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (hasLocalePrefix(pathname)) {
    return intlMiddleware(request);
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;

  if (cookieLocale && hasLocale(routing.locales, cookieLocale)) {
    if (cookieLocale !== routing.defaultLocale) {
      const url = request.nextUrl.clone();
      url.pathname = toLocalePath(pathname, cookieLocale);
      return NextResponse.redirect(url);
    }

    return intlMiddleware(request);
  }

  if (getCountryCode(request) === "FR") {
    const url = request.nextUrl.clone();
    url.pathname = toLocalePath(pathname, "fr");
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
