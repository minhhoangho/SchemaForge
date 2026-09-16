import { cookies, headers } from "next/headers";

import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import {
  LOCALE_COOKIE_NAME,
  parseThemePreference,
  THEME_COOKIE_NAME,
} from "@/lib/preferences/preference-cookies";
import { NONCE_HEADER_NAME } from "@/lib/security/content-security-policy";

import { resolveRequestLocale } from "./negotiate-locale";
import type { Locale } from "./supported-locales";

const ACCEPT_LANGUAGE_HEADER_NAME = "accept-language";

// These read the incoming request, so only Server Components call them.

export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);

  return resolveRequestLocale({
    cookieValue: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerList.get(ACCEPT_LANGUAGE_HEADER_NAME),
  });
}

export async function getRequestThemePreference(): Promise<ThemePreference> {
  const cookieStore = await cookies();

  return parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);
}

export async function getRequestNonce(): Promise<string | null> {
  const headerList = await headers();

  return headerList.get(NONCE_HEADER_NAME);
}
