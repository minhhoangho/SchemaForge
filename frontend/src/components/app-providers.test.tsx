import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { renderToString } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStorage } from "@/lib/storage/storage-context";
import { useThemePreference } from "@/lib/theme/use-theme-preference";

import { AppProviders } from "./app-providers";
import { useAuth } from "./auth-provider";

// The hosts need a signed-in session and IndexedDB to do anything visible, and
// their own tests cover that; here they only have to be mounted.
vi.mock("./upload-prompt-host", () => ({
  UploadPromptHost: () => <p>upload-prompt-host</p>,
}));
vi.mock("./background-sync-host", () => ({
  BackgroundSyncHost: () => <p>background-sync-host</p>,
}));

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

function AuthStatusLabel(): JSX.Element {
  const auth = useAuth((state) => state.auth);

  return <span>{`auth-${auth.status}`}</span>;
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
      <AppProviders locale="vi" themePreference="light" hasAuthHint={false}>
        <ThemeLabel />
      </AppProviders>,
    );

    expect(screen.getByText("Giao diện")).toBeDefined();
  });

  it("applies the initial theme preference", () => {
    render(
      <AppProviders locale="en" themePreference="dark" hasAuthHint={false}>
        <ThemePreferenceLabel />
      </AppProviders>,
    );

    expect(screen.getByText("dark")).toBeDefined();
  });

  it("renders a toast region with a translated label", () => {
    render(
      <AppProviders locale="vi" themePreference="light" hasAuthHint={false}>
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
      <AppProviders locale="en" themePreference="light" hasAuthHint={false}>
        <Tooltip>
          <TooltipTrigger>Undo</TooltipTrigger>
          <TooltipContent>Undo the last change</TooltipContent>
        </Tooltip>
      </AppProviders>,
    );

    await user.hover(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("tooltip")).toBeDefined();
  });

  it("provides the auth context to children", () => {
    // Server rendering runs no effect, so the auth store is not built yet and
    // children read the unknown state instead of a missing provider error.
    const html = renderToString(
      <AppProviders locale="en" themePreference="light" hasAuthHint={false}>
        <AuthStatusLabel />
      </AppProviders>,
    );

    expect(html).toContain("auth-unknown");
  });

  it("renders storage-dependent children while storage is still pending", () => {
    // Server rendering runs no effects, so storage stays pending exactly as it
    // does in the HTML the root layout sends.
    const html = renderToString(
      <AppProviders locale="en" themePreference="light" hasAuthHint={false}>
        <StorageStateLabel />
      </AppProviders>,
    );

    expect(html).toContain("storage-pending");
  });

  it("mounts the upload prompt and background sync hosts", () => {
    render(
      <AppProviders locale="en" themePreference="light" hasAuthHint={false}>
        <ThemeLabel />
      </AppProviders>,
    );

    expect(screen.getByText("upload-prompt-host")).toBeDefined();
    expect(screen.getByText("background-sync-host")).toBeDefined();
  });
});
