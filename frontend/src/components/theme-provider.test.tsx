import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { THEME_COOKIE_NAME } from "@/lib/preferences/preference-cookies";
import { useThemePreference } from "@/lib/theme/use-theme-preference";

import { ThemeProvider } from "./theme-provider";

// jsdom has no MediaQueryListEvent constructor, so the listener is handed the
// only part of the event the provider reads.
type ColorSchemeChangeListener = (
  event: Pick<MediaQueryListEvent, "matches">,
) => void;

type ColorSchemeStub = {
  readonly changeSystemColorScheme: (isDark: boolean) => void;
  readonly countListeners: () => number;
};

// jsdom has no matchMedia, and the stub in setup-tests never fires a change.
function stubSystemColorScheme(isDarkAtStart: boolean): ColorSchemeStub {
  let isSystemDark = isDarkAtStart;
  const listeners = new Set<ColorSchemeChangeListener>();

  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: isSystemDark,
    media,
    addEventListener: (_type: string, listener: ColorSchemeChangeListener) => {
      listeners.add(listener);
    },
    removeEventListener: (
      _type: string,
      listener: ColorSchemeChangeListener,
    ) => {
      listeners.delete(listener);
    },
  }));

  return {
    changeSystemColorScheme: (isDark: boolean) => {
      isSystemDark = isDark;
      listeners.forEach((listener) => {
        listener({ matches: isDark });
      });
    },
    countListeners: () => listeners.size,
  };
}

type ThemePreferenceProbeProps = { readonly nextPreference: ThemePreference };

function ThemePreferenceProbe({
  nextPreference,
}: ThemePreferenceProbeProps): JSX.Element {
  const { preference, setPreference } = useThemePreference();

  return (
    <button
      type="button"
      onClick={() => {
        setPreference(nextPreference);
      }}
    >
      {preference}
    </button>
  );
}

function renderThemeProvider(
  initialPreference: ThemePreference,
  nextPreference: ThemePreference,
): { readonly unmount: () => void } {
  return render(
    <ThemeProvider initialPreference={initialPreference}>
      <ThemePreferenceProbe nextPreference={nextPreference} />
    </ThemeProvider>,
  );
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("exposes the initial preference from the server", () => {
    stubSystemColorScheme(false);

    renderThemeProvider("light", "dark");

    expect(screen.getByRole("button", { name: "light" })).toBeDefined();
  });

  it("writes the sf-theme cookie when the preference changes", async () => {
    const user = userEvent.setup();
    stubSystemColorScheme(false);
    renderThemeProvider("light", "dark");

    await user.click(screen.getByRole("button", { name: "light" }));

    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
  });

  it("adds the dark class when switching to dark", async () => {
    const user = userEvent.setup();
    stubSystemColorScheme(false);
    renderThemeProvider("light", "dark");

    await user.click(screen.getByRole("button", { name: "light" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("follows the system color scheme while the preference is system", () => {
    const colorScheme = stubSystemColorScheme(false);
    renderThemeProvider("system", "light");

    colorScheme.changeSystemColorScheme(true);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("stops following the system color scheme after switching to light", async () => {
    const user = userEvent.setup();
    const colorScheme = stubSystemColorScheme(false);
    renderThemeProvider("system", "light");
    await user.click(screen.getByRole("button", { name: "system" }));

    colorScheme.changeSystemColorScheme(true);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("removes the system listener on unmount", () => {
    const colorScheme = stubSystemColorScheme(false);
    const { unmount } = renderThemeProvider("system", "light");
    const listenersWhileMounted = colorScheme.countListeners();

    unmount();

    expect([listenersWhileMounted, colorScheme.countListeners()]).toEqual([
      1, 0,
    ]);
  });
});
