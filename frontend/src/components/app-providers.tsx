"use client";

// Zod reads `jitless` when a schema is created, and core creates its schemas
// on import, so this configuration must load before every other import.
import "@/lib/zod-config";

import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/supported-locales";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { StorageProvider } from "@/lib/storage/storage-context";

type AppProvidersProps = {
  readonly locale: Locale;
  readonly themePreference: ThemePreference;
  readonly children: ReactNode;
};

// components/ui/ stays free of i18n, so the toast region name is translated
// here.
function AppToaster(): JSX.Element {
  const { t } = useTranslation("common");

  return <Toaster containerAriaLabel={t("notifications.label")} />;
}

export function AppProviders({
  locale,
  themePreference,
  children,
}: AppProvidersProps): JSX.Element {
  return (
    <I18nProvider locale={locale}>
      <ThemeProvider initialPreference={themePreference}>
        <TooltipProvider>
          <StorageProvider>
            {children}
            <AppToaster />
          </StorageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
