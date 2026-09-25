import type { RenderResult } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import type { JSX, ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AuthProvider } from "@/components/auth-provider";
import type { AuthProviderDependencies } from "@/components/auth-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { Locale } from "@/lib/i18n/supported-locales";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { StorageProvider } from "@/lib/storage/storage-context";
import {
  applyResolvedTheme,
  DARK_COLOR_SCHEME_QUERY,
  resolveTheme,
} from "@/lib/theme/resolve-theme";

import { createFakeAuthLockManager } from "./fake-auth-lock-manager";

const DEFAULT_TEST_LOCALE = "vi" satisfies Locale;
const DEFAULT_TEST_THEME_PREFERENCE = "light" satisfies ThemePreference;

// The Toaster takes its region name as a prop so components/ui/ stays free of
// i18n; this reads the same key AppProviders uses.
function TranslatedToaster(): JSX.Element {
  const { t } = useTranslation("common");

  return <Toaster containerAriaLabel={t("notifications.label")} />;
}

/**
 * Mounts storage and auth above the rendered element, as AppProviders does.
 * By default nobody is signed in: there is no hint cookie, so the provider
 * settles on signed-out without a request, and fetch throws if called.
 */
export type TestAuthOptions = {
  // Left out, StorageProvider builds browser storage (tests mock it).
  readonly storage?: StorageBundle;
  readonly hasAuthHint?: boolean;
  readonly dependencies?: Partial<AuthProviderDependencies>;
};

// Nothing is delivered between fake tabs unless a test passes its own.
class SilentBroadcastChannel extends EventTarget {
  postMessage(): void {
    // No other tab listens.
  }

  close(): void {
    // Nothing to release.
  }
}

function rejectFetch(): never {
  throw new Error("This test does not expect a network request.");
}

function createTestAuthDependencies(
  overrides: Partial<AuthProviderDependencies>,
): AuthProviderDependencies {
  return {
    fetchImpl: rejectFetch,
    authLockManager: createFakeAuthLockManager().lockManager,
    openChannel: (): BroadcastChannelLike => new SilentBroadcastChannel(),
    cookieJar: { cookie: "" },
    ...overrides,
  };
}

type TestAuthProvidersProps = {
  readonly auth: TestAuthOptions | undefined;
  readonly dependencies: AuthProviderDependencies;
  readonly children: ReactNode;
};

function TestAuthProviders({
  auth,
  dependencies,
  children,
}: TestAuthProvidersProps): JSX.Element {
  if (auth === undefined) {
    return <>{children}</>;
  }
  return (
    <StorageProvider storage={auth.storage}>
      <AuthProvider
        hasAuthHint={auth.hasAuthHint ?? false}
        dependencies={dependencies}
      >
        {children}
      </AuthProvider>
    </StorageProvider>
  );
}

type ProvidersProps = {
  readonly locale: Locale;
  readonly themePreference: ThemePreference;
  readonly auth: TestAuthOptions | undefined;
  readonly authDependencies: AuthProviderDependencies;
  readonly children: ReactNode;
};

function Providers({
  locale,
  themePreference,
  auth,
  authDependencies,
  children,
}: ProvidersProps): JSX.Element {
  return (
    <I18nProvider locale={locale}>
      <ThemeProvider initialPreference={themePreference}>
        <TooltipProvider>
          <TestAuthProviders auth={auth} dependencies={authDependencies}>
            {children}
          </TestAuthProviders>
          <TranslatedToaster />
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

type RenderWithProvidersOptions = {
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
  readonly auth?: TestAuthOptions;
};

/**
 * Renders `ui` inside the provider tree the app mounts, so component tests
 * read the same translations, theme tokens and toast region as the real
 * screens. Returns the React Testing Library result plus a `user` bound to
 * this render; `rerender` keeps the providers in place. With `auth`, the
 * element also renders inside StorageProvider and AuthProvider.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult & { readonly user: UserEvent } {
  const locale = options.locale ?? DEFAULT_TEST_LOCALE;
  const themePreference =
    options.themePreference ?? DEFAULT_TEST_THEME_PREFERENCE;
  const user = userEvent.setup();
  // Built once, so a rerender keeps the same AuthProvider runtime.
  const authDependencies = createTestAuthDependencies(
    options.auth?.dependencies ?? {},
  );

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
      <Providers
        locale={locale}
        themePreference={themePreference}
        auth={options.auth}
        authDependencies={authDependencies}
      >
        {children}
      </Providers>
    ),
  });

  return { ...result, user };
}
