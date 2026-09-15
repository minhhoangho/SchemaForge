import type { Locale } from "@/lib/i18n/supported-locales";
import { isLocale } from "@/lib/i18n/supported-locales";

export const THEME_COOKIE_NAME = "sf-theme";
export const LOCALE_COOKIE_NAME = "sf-locale";
export const PREFERENCE_COOKIE_MAX_AGE_SECONDS = 31_536_000;

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE = "system" satisfies ThemePreference;

export type PreferenceCookie =
  | { readonly name: typeof THEME_COOKIE_NAME; readonly value: ThemePreference }
  | { readonly name: typeof LOCALE_COOKIE_NAME; readonly value: Locale };

type PreferenceCookieOptions = { readonly isSecure: boolean };

function isThemePreference(value: string): value is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === value);
}

export function parseThemePreference(
  value: string | undefined,
): ThemePreference {
  if (value === undefined || !isThemePreference(value)) {
    return DEFAULT_THEME_PREFERENCE;
  }
  return value;
}

// Returns null for a missing or unknown value so the caller can fall back to
// the Accept-Language header.
export function parseLocalePreference(
  value: string | undefined,
): Locale | null {
  if (value === undefined || !isLocale(value)) {
    return null;
  }
  return value;
}

// Values come only from the allow-lists above, so they need no encoding.
export function serializePreferenceCookie(
  cookie: PreferenceCookie,
  options: PreferenceCookieOptions,
): string {
  const serialized = `${cookie.name}=${cookie.value}; Path=/; Max-Age=${String(PREFERENCE_COOKIE_MAX_AGE_SECONDS)}; SameSite=Lax`;
  return options.isSecure ? `${serialized}; Secure` : serialized;
}

export function writePreferenceCookie(
  cookie: PreferenceCookie,
  options: PreferenceCookieOptions,
): void {
  document.cookie = serializePreferenceCookie(cookie, options);
}
