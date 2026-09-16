import type { RenderResult } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import type { JSX, ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/supported-locales";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import {
  applyResolvedTheme,
  DARK_COLOR_SCHEME_QUERY,
  resolveTheme,
} from "@/lib/theme/resolve-theme";

const DEFAULT_TEST_LOCALE = "vi" satisfies Locale;
const DEFAULT_TEST_THEME_PREFERENCE = "light" satisfies ThemePreference;

// The Toaster takes its region name as a prop so components/ui/ stays free of
// i18n; this reads the same key AppProviders uses.
function TranslatedToaster(): JSX.Element {
  const { t } = useTranslation("common");

  return <Toaster containerAriaLabel={t("notifications.label")} />;
}

type ProvidersProps = {
  readonly locale: Locale;
  readonly themePreference: ThemePreference;
  readonly children: ReactNode;
};

function Providers({
  locale,
  themePreference,
  children,
}: ProvidersProps): JSX.Element {
  return (
    <I18nProvider locale={locale}>
      <ThemeProvider initialPreference={themePreference}>
        <TooltipProvider>
          {children}
          <TranslatedToaster />
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

type RenderWithProvidersOptions = {
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

/**
 * Renders `ui` inside the provider tree the app mounts, so component tests
 * read the same translations, theme tokens and toast region as the real
 * screens. Returns the React Testing Library result plus a `user` bound to
 * this render; `rerender` keeps the providers in place.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult & { readonly user: UserEvent } {
  const locale = options.locale ?? DEFAULT_TEST_LOCALE;
  const themePreference =
    options.themePreference ?? DEFAULT_TEST_THEME_PREFERENCE;
  const user = userEvent.setup();

  // public/theme-init.js never runs in jsdom, so the class and the lang
  // attribute it would have set before the first paint are applied here. The
  // media query is read the same way the script reads it, so "system" follows
  // stubMatchMedia; the stub in setup-tests always answers light.
  document.documentElement.lang = locale;
  applyResolvedTheme(
    resolveTheme(
      themePreference,
      window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches,
    ),
  );

  const result = render(ui, {
    wrapper: ({ children }: { readonly children: ReactNode }): JSX.Element => (
      <Providers locale={locale} themePreference={themePreference}>
        {children}
      </Providers>
    ),
  });

  return { ...result, user };
}
