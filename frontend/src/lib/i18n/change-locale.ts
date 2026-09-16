import type { i18n } from "i18next";

import {
  LOCALE_COOKIE_NAME,
  writePreferenceCookie,
} from "@/lib/preferences/preference-cookies";

import type { Locale } from "./supported-locales";

type ChangeLocaleDependencies = {
  readonly i18n: Pick<i18n, "changeLanguage">;
  readonly refresh: () => void;
  readonly isSecure: boolean;
};

export async function changeLocale(
  locale: Locale,
  dependencies: ChangeLocaleDependencies,
): Promise<void> {
  await dependencies.i18n.changeLanguage(locale);
  writePreferenceCookie(
    { name: LOCALE_COOKIE_NAME, value: locale },
    { isSecure: dependencies.isSecure },
  );
  document.documentElement.lang = locale;
  dependencies.refresh();
}
