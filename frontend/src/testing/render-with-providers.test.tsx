import { screen } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";

import { createFakeLockRegistry } from "./fake-lock-registry";
import { stubMatchMedia } from "./match-media-stub";
import { renderWithProviders } from "./render-with-providers";

function ThemeLabel(): JSX.Element {
  const { t } = useTranslation("common");

  return <span>{t("theme.label")}</span>;
}

function AuthStatus(): JSX.Element {
  const status = useAuth((state) => state.auth.status);

  return <span>{`status:${status}`}</span>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderWithProviders", () => {
  it("renders Vietnamese translations by default", () => {
    renderWithProviders(<ThemeLabel />);

    expect(screen.getByText("Giao diện")).toBeDefined();
  });

  it("renders translations for the requested locale", () => {
    renderWithProviders(<ThemeLabel />, { locale: "en" });

    expect(screen.getByText("Theme")).toBeDefined();
    expect(document.documentElement.lang).toBe("en");
  });

  it("applies the dark class for the dark theme", () => {
    renderWithProviders(<ThemeLabel />, { themePreference: "dark" });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("follows the stubbed color scheme for the system theme", () => {
    stubMatchMedia({ isDarkPreferred: true });

    renderWithProviders(<ThemeLabel />, { themePreference: "system" });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("provides a user-event instance that can click", async () => {
    const handleClick = vi.fn<() => void>();
    const { user } = renderWithProviders(
      <button type="button" onClick={handleClick}>
        Add table
      </button>,
    );

    await user.click(screen.getByRole("button", { name: "Add table" }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders tooltips without a missing provider error", async () => {
    const { user } = renderWithProviders(
      <Tooltip>
        <TooltipTrigger>Undo</TooltipTrigger>
        <TooltipContent>Undo the last change</TooltipContent>
      </Tooltip>,
    );

    await user.hover(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("tooltip")).toBeDefined();
  });

  it("wraps children in a signed-out auth provider without calling fetch", async () => {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    const globalFetch = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", globalFetch);

    renderWithProviders(<AuthStatus />, {
      auth: {
        storage: {
          database,
          lockManager: createSchemaLockManager(
            createFakeLockRegistry().request,
          ),
          repository: createSchemaRepository({
            database,
            clock: () => 1,
            generateId: () => "00000000-0000-4000-8000-000000000001",
          }),
        },
      },
    });

    expect(await screen.findByText("status:signed-out")).toBeDefined();
    expect(globalFetch).not.toHaveBeenCalled();
    database.close();
  });
});
