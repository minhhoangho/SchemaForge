"use client";

import type { JSX, ReactNode } from "react";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";

import { createI18nInstance } from "@/lib/i18n/create-i18n-instance";
import type { Locale } from "@/lib/i18n/supported-locales";

type I18nProviderProps = {
  readonly locale: Locale;
  readonly children: ReactNode;
};

export function I18nProvider({
  locale,
  children,
}: I18nProviderProps): JSX.Element {
  // The instance is created once so changing the language never remounts the
  // editor below this provider.
  const [instance] = useState(() => createI18nInstance(locale));

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
