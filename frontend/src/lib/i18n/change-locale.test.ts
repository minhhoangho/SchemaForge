import { beforeEach, describe, expect, it } from "vitest";

import { LOCALE_COOKIE_NAME } from "@/lib/preferences/preference-cookies";

import { changeLocale } from "./change-locale";
import { createI18nInstance } from "./create-i18n-instance";

function ignoreRefresh(): void {
  // The router is exercised by the test that asserts the refresh order.
}

beforeEach(() => {
  document.documentElement.lang = "";
  document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
});

describe("changeLocale", () => {
  it("changes the i18next language", async () => {
    const i18n = createI18nInstance("en");

    await changeLocale("vi", { i18n, refresh: ignoreRefresh, isSecure: false });

    expect(i18n.language).toBe("vi");
  });

  it("writes the sf-locale cookie", async () => {
    const i18n = createI18nInstance("en");

    await changeLocale("vi", { i18n, refresh: ignoreRefresh, isSecure: false });

    expect(document.cookie).toContain("sf-locale=vi");
  });

  it("sets the html lang attribute", async () => {
    const i18n = createI18nInstance("en");

    await changeLocale("vi", { i18n, refresh: ignoreRefresh, isSecure: false });

    expect(document.documentElement.lang).toBe("vi");
  });

  it("refreshes the router after the language has changed", async () => {
    const i18n = createI18nInstance("en");
    let languageWhenRefreshed = "";

    await changeLocale("vi", {
      i18n,
      refresh: () => {
        languageWhenRefreshed = i18n.language;
      },
      isSecure: false,
    });

    expect(languageWhenRefreshed).toBe("vi");
  });
});
