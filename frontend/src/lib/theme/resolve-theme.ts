import type { ThemePreference } from "@/lib/preferences/preference-cookies";

export const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

// shadcn/ui switches every token through this class on <html>.
const DARK_CLASS_NAME = "dark";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(
  preference: ThemePreference,
  isDarkPreferred: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return isDarkPreferred ? "dark" : "light";
  }
  return preference;
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS_NAME, theme === "dark");
  root.style.colorScheme = theme;
}
