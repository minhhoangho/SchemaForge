import { createSampleSchema } from "@schemaforge/core/testing";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { CloudVersionState } from "../../hooks/use-cloud-resolution";
import type { SchemaVersionSummary } from "../../lib/summarize-schema-version";
import { ConflictDialog } from "./conflict-dialog";

const LOCAL_UPDATED_AT = Date.parse("2026-09-18T09:30:00.000Z");
const CLOUD_UPDATED_AT = Date.parse("2026-09-19T14:45:00.000Z");
const LOCAL_SUMMARY: SchemaVersionSummary = {
  updatedAt: LOCAL_UPDATED_AT,
  tableCount: 1,
  columnCount: 1,
};
const LOADED: CloudVersionState = {
  kind: "loaded",
  revision: 2,
  document: createSampleSchema(),
  summary: { updatedAt: CLOUD_UPDATED_AT, tableCount: 3, columnCount: 12 },
};

type Handlers = {
  readonly keepLocal: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly adoptCloudVersion: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly reloadCloudVersion: ReturnType<typeof vi.fn<() => void>>;
  readonly onClose: ReturnType<typeof vi.fn<() => void>>;
};

type RenderOptions = {
  readonly cloudVersion?: CloudVersionState;
  readonly isBusy?: boolean;
  readonly themePreference?: "light" | "dark";
};

function formatTime(time: number): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time);
}

function renderDialog({
  cloudVersion = LOADED,
  isBusy = false,
  themePreference = "light",
}: RenderOptions = {}): Handlers & ReturnType<typeof renderWithProviders> {
  const handlers: Handlers = {
    keepLocal: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    adoptCloudVersion: vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
    reloadCloudVersion: vi.fn<() => void>(),
    onClose: vi.fn<() => void>(),
  };
  const rendered = renderWithProviders(
    <ConflictDialog
      open
      localVersion={LOCAL_SUMMARY}
      resolution={{ cloudVersion, isBusy, ...handlers }}
      onClose={handlers.onClose}
      onReturnFocus={vi.fn<() => void>()}
    />,
    { locale: "en", themePreference },
  );
  return { ...handlers, ...rendered };
}

function getDialog(): HTMLElement {
  return screen.getByRole("alertdialog", {
    name: "This schema was changed somewhere else",
  });
}

function getColumn(name: string): HTMLElement {
  return within(getDialog()).getByRole("region", { name });
}

describe("ConflictDialog", () => {
  it("shows the modified time, table count and column count of both versions", () => {
    renderDialog();

    expect({
      local: getColumn("Version on this device").textContent,
      cloud: getColumn("Version in the cloud").textContent,
    }).toEqual({
      local: `Version on this deviceUpdated ${formatTime(LOCAL_UPDATED_AT)}1 table1 column`,
      cloud: `Version in the cloudUpdated ${formatTime(CLOUD_UPDATED_AT)}3 tables12 columns`,
    });
  });

  it("calls keepLocal from Keep this device's version", async () => {
    const { user, keepLocal } = renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Keep the version on this device" }),
    );

    expect(keepLocal).toHaveBeenCalledOnce();
  });

  it("calls adoptCloudVersion from Use the cloud version", async () => {
    const { user, adoptCloudVersion } = renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Use the cloud version" }),
    );

    expect(adoptCloudVersion).toHaveBeenCalledOnce();
  });

  it("disables both choices while the cloud version is loading", () => {
    renderDialog({ cloudVersion: { kind: "loading" } });

    expect({
      keepLocal: screen
        .getByRole("button", { name: "Keep the version on this device" })
        .hasAttribute("disabled"),
      useCloud: screen
        .getByRole("button", { name: "Use the cloud version" })
        .hasAttribute("disabled"),
      loadingText: within(getColumn("Version in the cloud")).getByText(
        "Loading the cloud version",
      ).className,
    }).toEqual({ keepLocal: true, useCloud: true, loadingText: "sr-only" });
  });

  it("disables both choices while a choice is running", () => {
    renderDialog({ isBusy: true });

    expect({
      keepLocal: screen
        .getByRole("button", { name: "Keep the version on this device" })
        .hasAttribute("disabled"),
      useCloud: screen
        .getByRole("button", { name: "Use the cloud version" })
        .hasAttribute("disabled"),
    }).toEqual({ keepLocal: true, useCloud: true });
  });

  it("shows a retry when the cloud version fails to load", async () => {
    const { user, reloadCloudVersion } = renderDialog({
      cloudVersion: { kind: "failed", failure: { kind: "network" } },
    });

    expect(within(getDialog()).getByRole("alert").textContent).toBe(
      "You lost your network connection.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(reloadCloudVersion).toHaveBeenCalledOnce();
  });

  it("disables Use the cloud version when the cloud version is unsupported", () => {
    renderDialog({ cloudVersion: { kind: "version-unsupported" } });

    expect({
      message:
        within(getColumn("Version in the cloud")).queryByText(
          "The schema was saved by a newer version of SchemaForge. Reload the page.",
        ) !== null,
      useCloud: screen
        .getByRole("button", { name: "Use the cloud version" })
        .hasAttribute("disabled"),
    }).toEqual({ message: true, useCloud: true });
  });

  it("closes on Escape without changing the sync status", async () => {
    const { user, onClose, keepLocal, adoptCloudVersion } = renderDialog();

    await user.keyboard("{Escape}");

    expect({
      closeCalls: onClose.mock.calls.length,
      choiceCalls:
        keepLocal.mock.calls.length + adoptCloudVersion.mock.calls.length,
    }).toEqual({ closeCalls: 1, choiceCalls: 0 });
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the light and dark themes (%s)",
    async (themePreference) => {
      renderDialog({ themePreference });

      await expectNoAxeViolations(getDialog());
    },
  );
});
