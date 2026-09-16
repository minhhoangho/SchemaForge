import { render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { THEME_COOKIE_NAME } from "@/lib/preferences/preference-cookies";
import { useThemePreference } from "@/lib/theme/use-theme-preference";
import { stubMatchMedia } from "@/testing/match-media-stub";
import { renderWithProviders } from "@/testing/render-with-providers";

import { ThemeProvider } from "./theme-provider";

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

afterEach(() => {
  document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("exposes the initial preference from the server", () => {
    stubMatchMedia({ isDarkPreferred: false });

    renderWithProviders(<ThemePreferenceProbe nextPreference="dark" />, {
      themePreference: "light",
    });

    expect(screen.getByRole("button", { name: "light" })).toBeDefined();
  });

  it("writes the sf-theme cookie when the preference changes", async () => {
    stubMatchMedia({ isDarkPreferred: false });
    const { user } = renderWithProviders(
      <ThemePreferenceProbe nextPreference="dark" />,
      { themePreference: "light" },
    );

    await user.click(screen.getByRole("button", { name: "light" }));

    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
  });

  it("adds the dark class when switching to dark", async () => {
    stubMatchMedia({ isDarkPreferred: false });
    const { user } = renderWithProviders(
      <ThemePreferenceProbe nextPreference="dark" />,
      { themePreference: "light" },
    );

    await user.click(screen.getByRole("button", { name: "light" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("follows the system color scheme while the preference is system", () => {
    const colorScheme = stubMatchMedia({ isDarkPreferred: false });
    renderWithProviders(<ThemePreferenceProbe nextPreference="light" />, {
      themePreference: "system",
    });

    colorScheme.setPrefersDark(true);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("stops following the system color scheme after switching to light", async () => {
    const colorScheme = stubMatchMedia({ isDarkPreferred: false });
    const { user } = renderWithProviders(
      <ThemePreferenceProbe nextPreference="light" />,
      { themePreference: "system" },
    );
    await user.click(screen.getByRole("button", { name: "system" }));

    colorScheme.setPrefersDark(true);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("removes the system listener on unmount", () => {
    const colorScheme = stubMatchMedia({ isDarkPreferred: false });
    // The provider stands alone here because the Toaster that
    // renderWithProviders mounts listens to the same media query and never
    // removes its listener, so the count would not be the provider's own.
    const { unmount } = render(
      <ThemeProvider initialPreference="system">
        <ThemePreferenceProbe nextPreference="light" />
      </ThemeProvider>,
    );
    const listenersWhileMounted = colorScheme.countListeners();

    unmount();

    expect([listenersWhileMounted, colorScheme.countListeners()]).toEqual([
      1, 0,
    ]);
  });
});
