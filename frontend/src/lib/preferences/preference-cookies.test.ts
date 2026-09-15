import { afterEach, describe, expect, it } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";

import type { ThemePreference } from "./preference-cookies";
import {
  LOCALE_COOKIE_NAME,
  THEME_COOKIE_NAME,
  parseLocalePreference,
  parseThemePreference,
  serializePreferenceCookie,
  writePreferenceCookie,
} from "./preference-cookies";

describe("parseThemePreference", () => {
  it.each<[string | undefined, ThemePreference]>([
    ["light", "light"],
    ["dark", "dark"],
    ["system", "system"],
    [undefined, "system"],
    ["Dark", "system"],
    ["blue", "system"],
  ])("parses %s as the %s theme preference", (value, expected) => {
    expect(parseThemePreference(value)).toBe(expected);
  });
});

describe("parseLocalePreference", () => {
  it.each<[string | undefined, Locale | null]>([
    ["vi", "vi"],
    ["en", "en"],
    [undefined, null],
    ["fr", null],
  ])("parses %s as the %s locale preference", (value, expected) => {
    expect(parseLocalePreference(value)).toBe(expected);
  });
});

describe("serializePreferenceCookie", () => {
  it("serializes a preference cookie with path, max age and SameSite", () => {
    const serialized = serializePreferenceCookie(
      { name: THEME_COOKIE_NAME, value: "dark" },
      { isSecure: false },
    );

    expect(serialized).toBe(
      "sf-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });

  it("adds Secure when requested", () => {
    const serialized = serializePreferenceCookie(
      { name: LOCALE_COOKIE_NAME, value: "vi" },
      { isSecure: true },
    );

    expect(serialized).toBe(
      "sf-locale=vi; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
  });
});

describe("writePreferenceCookie", () => {
  afterEach(() => {
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
  });

  it("writes a cookie that document.cookie reads back", () => {
    writePreferenceCookie(
      { name: LOCALE_COOKIE_NAME, value: "vi" },
      { isSecure: false },
    );

    expect(document.cookie).toBe("sf-locale=vi");
  });
});
