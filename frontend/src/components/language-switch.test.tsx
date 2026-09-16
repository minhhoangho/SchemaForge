import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import { LOCALE_COOKIE_NAME } from "@/lib/preferences/preference-cookies";

import { I18nProvider } from "./i18n-provider";
import { LanguageSwitch } from "./language-switch";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

// The visible short name is part of the accessible name (WCAG 2.5.3).
const VIETNAMESE_TRIGGER_NAME = "Ngôn ngữ VI";
const ENGLISH_TRIGGER_NAME = "Language EN";

function renderLanguageSwitch(locale: Locale): void {
  render(
    <I18nProvider locale={locale}>
      <LanguageSwitch />
    </I18nProvider>,
  );
}

async function openMenu(user: UserEvent): Promise<void> {
  await user.click(
    screen.getByRole("button", { name: VIETNAMESE_TRIGGER_NAME }),
  );
  await screen.findByRole("menu");
}

beforeEach(() => {
  refresh.mockClear();
  document.documentElement.lang = "";
  document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
});

describe("LanguageSwitch", () => {
  it("names the trigger with the translated language label", () => {
    renderLanguageSwitch("vi");

    expect(
      screen.getByRole("button", { name: VIETNAMESE_TRIGGER_NAME }),
    ).toBeDefined();
  });

  it("marks the current language as checked", async () => {
    const user = userEvent.setup();
    renderLanguageSwitch("vi");

    await openMenu(user);

    expect(
      screen.getByRole("menuitemradio", {
        name: "Tiếng Việt",
        checked: true,
      }),
    ).toBeDefined();
  });

  it("marks the language names with their own language", async () => {
    const user = userEvent.setup();
    renderLanguageSwitch("vi");

    await openMenu(user);

    expect([
      screen.getByText("Tiếng Việt").getAttribute("lang"),
      screen.getByText("English").getAttribute("lang"),
    ]).toEqual(["vi", "en"]);
  });

  it("opens the menu with the keyboard", async () => {
    const user = userEvent.setup();
    renderLanguageSwitch("vi");

    await user.tab();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("menu")).toBeDefined();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderLanguageSwitch("vi");
    const trigger = screen.getByRole("button", {
      name: VIETNAMESE_TRIGGER_NAME,
    });
    await openMenu(user);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("switches to English from the menu", async () => {
    const user = userEvent.setup();
    renderLanguageSwitch("vi");
    await openMenu(user);

    await user.click(screen.getByRole("menuitemradio", { name: "English" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: ENGLISH_TRIGGER_NAME }),
      ).toBeDefined();
    });
    expect(document.documentElement.lang).toBe("en");
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=en`);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
