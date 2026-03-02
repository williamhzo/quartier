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

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (hasLocalePrefix(pathname)) {
    return intlMiddleware(request);
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;

  // Keep deep links stable: only negotiate locale at the unprefixed homepage.
  if (
    pathname === "/" &&
    cookieLocale &&
    hasLocale(routing.locales, cookieLocale)
  ) {
    if (cookieLocale !== routing.defaultLocale) {
      const url = request.nextUrl.clone();
      url.pathname = toLocalePath(pathname, cookieLocale);
      return NextResponse.redirect(url);
    }

    return intlMiddleware(request);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
