import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { THEME_COOKIE_NAME } from "@/lib/preferences/preference-cookies";
import { renderWithProviders } from "@/testing/render-with-providers";

import { ThemeSwitch } from "./theme-switch";

const VIETNAMESE_THEME_LABEL = "Giao diện";
const ENGLISH_THEME_LABEL = "Theme";

async function openMenu(user: UserEvent): Promise<void> {
  await user.click(
    screen.getByRole("button", { name: VIETNAMESE_THEME_LABEL }),
  );
  await screen.findByRole("menu");
}

afterEach(() => {
  document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0`;
});

describe("ThemeSwitch", () => {
  it.each([
    ["vi", VIETNAMESE_THEME_LABEL],
    ["en", ENGLISH_THEME_LABEL],
  ] as const)(
    "names the trigger with the translated theme label in %s",
    (locale, label) => {
      renderWithProviders(<ThemeSwitch />, {
        locale,
        themePreference: "system",
      });

      expect(screen.getByRole("button", { name: label })).toBeDefined();
    },
  );

  it("marks the current preference as checked", async () => {
    const { user } = renderWithProviders(<ThemeSwitch />, {
      locale: "vi",
      themePreference: "system",
    });

    await openMenu(user);

    expect(
      screen.getByRole("menuitemradio", {
        name: "Theo hệ thống",
        checked: true,
      }),
    ).toBeDefined();
  });

  it("switches to dark from the menu", async () => {
    const { user } = renderWithProviders(<ThemeSwitch />, {
      locale: "vi",
      themePreference: "system",
    });
    await openMenu(user);

    await user.click(screen.getByRole("menuitemradio", { name: "Tối" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
  });
});
