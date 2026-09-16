"use client";

import type { JSX, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { env } from "@/lib/env";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import {
  THEME_COOKIE_NAME,
  writePreferenceCookie,
} from "@/lib/preferences/preference-cookies";
import {
  applyResolvedTheme,
  DARK_COLOR_SCHEME_QUERY,
  resolveTheme,
} from "@/lib/theme/resolve-theme";
import { ThemePreferenceContext } from "@/lib/theme/use-theme-preference";

type ThemeProviderProps = {
  readonly initialPreference: ThemePreference;
  readonly children: ReactNode;
};

export function ThemeProvider({
  initialPreference,
  children,
}: ThemeProviderProps): JSX.Element {
  // public/theme-init.js already applied the theme before the first paint, so
  // mounting must not touch <html> again.
  const [preference, setStoredPreference] = useState(initialPreference);

  const setPreference = useCallback((next: ThemePreference): void => {
    writePreferenceCookie(
      { name: THEME_COOKIE_NAME, value: next },
      { isSecure: env.isProduction },
    );
    setStoredPreference(next);
    applyResolvedTheme(
      resolveTheme(next, window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches),
    );
  }, []);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const query = window.matchMedia(DARK_COLOR_SCHEME_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => {
      applyResolvedTheme(resolveTheme("system", event.matches));
    };

    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [preference]);

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ThemePreferenceContext value={value}>{children}</ThemePreferenceContext>
  );
}
