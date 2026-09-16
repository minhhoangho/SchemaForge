import "./globals.css";

import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";

import { AppProviders } from "@/components/app-providers";
import { APP_NAME } from "@/lib/app-name";
import {
  getRequestLocale,
  getRequestNonce,
  getRequestThemePreference,
} from "@/lib/i18n/request-locale";
import { getServerTranslation } from "@/lib/i18n/server-translation";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getServerTranslation(locale, "common");

  return {
    title: t("meta.title", { appName: APP_NAME }),
    description: t("meta.description"),
  };
}

type RootLayoutProps = {
  readonly children: ReactNode;
};

export default async function RootLayout({
  children,
}: RootLayoutProps): Promise<JSX.Element> {
  const [locale, themePreference, nonce] = await Promise.all([
    getRequestLocale(),
    getRequestThemePreference(),
    getRequestNonce(),
  ]);

  // theme-init.js sets the dark class before the first paint, so the script
  // has neither async nor defer, and <html> suppresses the hydration warning
  // for the class and style it changes.
  return (
    <html
      lang={locale}
      data-theme-preference={themePreference}
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- the theme class must be set before the first paint, which next/script cannot guarantee */}
        <script src="/theme-init.js" nonce={nonce ?? undefined} />
      </head>
      <body>
        <AppProviders locale={locale} themePreference={themePreference}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
