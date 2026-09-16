import type { TFunction } from "i18next";

import { createI18nInstance } from "./create-i18n-instance";
import type { Namespace } from "./resources";
import type { Locale } from "./supported-locales";

// Every call gets its own instance so concurrent requests never share a
// language.
export function getServerTranslation<N extends Namespace>(
  locale: Locale,
  namespace: N,
): TFunction<N> {
  return createI18nInstance(locale).getFixedT(locale, namespace);
}
