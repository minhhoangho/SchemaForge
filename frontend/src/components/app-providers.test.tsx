import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { renderToString } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStorage } from "@/lib/storage/storage-context";
import { useThemePreference } from "@/lib/theme/use-theme-preference";

import { AppProviders } from "./app-providers";

// AppProviders is rendered with plain render: renderWithProviders already
// wraps the i18n, theme, tooltip and toast providers, which would double up.

function ThemeLabel(): JSX.Element {
  const { t } = useTranslation("common");

  return <span>{t("theme.label")}</span>;
}

function ThemePreferenceLabel(): JSX.Element {
  const { preference } = useThemePreference();

  return <span>{preference}</span>;
}

function StorageStateLabel(): JSX.Element {
  const { kind } = useStorage();

  return <span>{`storage-${kind}`}</span>;
}

describe("AppProviders", () => {
  it("configures zod in jitless mode", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("renders children translated in the given locale", () => {
    render(
      <AppProviders locale="vi" themePreference="light">
        <ThemeLabel />
      </AppProviders>,
    );

    expect(screen.getByText("Giao diện")).toBeDefined();
  });

  it("applies the initial theme preference", () => {
    render(
      <AppProviders locale="en" themePreference="dark">
        <ThemePreferenceLabel />
      </AppProviders>,
    );

    expect(screen.getByText("dark")).toBeDefined();
  });

  it("renders a toast region with a translated label", () => {
    render(
      <AppProviders locale="vi" themePreference="light">
        <ThemeLabel />
      </AppProviders>,
    );

    // Sonner appends its default focus hotkey to the region name.
    expect(
      screen.getByRole("region", { name: "Thông báo alt+T" }),
    ).toBeDefined();
  });

  it("renders tooltips without a missing provider error", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders locale="en" themePreference="light">
        <Tooltip>
          <TooltipTrigger>Undo</TooltipTrigger>
          <TooltipContent>Undo the last change</TooltipContent>
        </Tooltip>
      </AppProviders>,
    );

    await user.hover(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("tooltip")).toBeDefined();
  });

  it("renders storage-dependent children while storage is still pending", () => {
    // Server rendering runs no effects, so storage stays pending exactly as it
    // does in the HTML the root layout sends.
    const html = renderToString(
      <AppProviders locale="en" themePreference="light">
        <StorageStateLabel />
      </AppProviders>,
    );

    expect(html).toContain("storage-pending");
  });
});
