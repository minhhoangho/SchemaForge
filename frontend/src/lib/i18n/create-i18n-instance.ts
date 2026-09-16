import type { i18n } from "i18next";
import { createInstance } from "i18next";

import { DEFAULT_NAMESPACE, NAMESPACES, RESOURCES } from "./resources";
import type { Locale } from "./supported-locales";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./supported-locales";

export function createI18nInstance(locale: Locale): i18n {
  const instance = createInstance();

  // Resources are bundled and initAsync is false, so init finishes
  // synchronously and the promise never needs to be awaited;
  // create-i18n-instance.test.ts asserts that.
  void instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,
    resources: RESOURCES,
    interpolation: { escapeValue: false },
    initAsync: false,
    react: { useSuspense: false },
  });

  return instance;
}
