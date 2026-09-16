import { createContext, useContext } from "react";

import type { ThemePreference } from "@/lib/preferences/preference-cookies";

export type ThemePreferenceContextValue = {
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
};

export const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

export function useThemePreference(): ThemePreferenceContextValue {
  const value = useContext(ThemePreferenceContext);

  if (value === null) {
    throw new Error("useThemePreference must be used inside a ThemeProvider.");
  }

  return value;
}
