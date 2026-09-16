import { vi } from "vitest";

import { DARK_COLOR_SCHEME_QUERY } from "@/lib/theme/resolve-theme";

// jsdom 30 has no MediaQueryListEvent constructor, so listeners are handed
// only the part of the event application code reads.
type ColorSchemeChangeListener = (
  event: Pick<MediaQueryListEvent, "matches">,
) => void;

type StubMatchMediaOptions = {
  // Named after resolveTheme's parameter rather than the media query.
  readonly isDarkPreferred: boolean;
};

export type MatchMediaStub = {
  readonly setPrefersDark: (isDark: boolean) => void;
  // How many change listeners are attached right now, so a test can prove a
  // component removes its listener when it unmounts.
  readonly countListeners: () => number;
  readonly restore: () => void;
};

/**
 * Replaces the always-light `matchMedia` stub from `setup-tests.ts` with one
 * that reports a color scheme and can change it while the test runs. Only
 * `(prefers-color-scheme: dark)` ever matches; every other query stays false.
 */
export function stubMatchMedia({
  isDarkPreferred,
}: StubMatchMediaOptions): MatchMediaStub {
  // Bound because restore() puts it back as a plain function value, and jsdom
  // implements matchMedia as a method on window.
  const originalMatchMedia = window.matchMedia.bind(window);
  const listeners = new Set<ColorSchemeChangeListener>();
  let isCurrentlyDark = isDarkPreferred;

  vi.stubGlobal("matchMedia", (media: string) => {
    const isColorSchemeQuery = media === DARK_COLOR_SCHEME_QUERY;

    return {
      // A getter, because a real MediaQueryList keeps reporting the live
      // value to whoever held on to it.
      get matches(): boolean {
        return isColorSchemeQuery && isCurrentlyDark;
      },
      media,
      addEventListener: (
        _type: string,
        listener: ColorSchemeChangeListener,
      ): void => {
        if (isColorSchemeQuery) {
          listeners.add(listener);
        }
      },
      removeEventListener: (
        _type: string,
        listener: ColorSchemeChangeListener,
      ): void => {
        listeners.delete(listener);
      },
    };
  });

  return {
    setPrefersDark: (isDark: boolean): void => {
      isCurrentlyDark = isDark;
      listeners.forEach((listener) => {
        listener({ matches: isDark });
      });
    },
    countListeners: (): number => listeners.size,
    restore: (): void => {
      vi.stubGlobal("matchMedia", originalMatchMedia);
    },
  };
}
