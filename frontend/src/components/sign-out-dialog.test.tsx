import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { SignOutDialog } from "./sign-out-dialog";
import type { SignOutFlowState } from "./use-sign-out-flow";

type Handlers = {
  readonly onTrySync: ReturnType<typeof vi.fn<() => void>>;
  readonly onConfirm: ReturnType<typeof vi.fn<() => void>>;
  readonly onCancel: ReturnType<typeof vi.fn<() => void>>;
  readonly onReturnFocus: ReturnType<typeof vi.fn<() => void>>;
};

function renderDialog(
  state: SignOutFlowState,
  themePreference: "light" | "dark" = "light",
): Handlers & ReturnType<typeof renderWithProviders> {
  const handlers: Handlers = {
    onTrySync: vi.fn<() => void>(),
    onConfirm: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
    onReturnFocus: vi.fn<() => void>(),
  };
  const rendered = renderWithProviders(
    <SignOutDialog state={state} {...handlers} />,
    { locale: "en", themePreference },
  );
  return { ...handlers, ...rendered };
}

describe("SignOutDialog", () => {
  it("shows the number of unsynced schemas", () => {
    renderDialog({ kind: "confirming", unsyncedCount: 2 });

    expect(
      screen.getByText(
        "2 schemas have changes that are not saved to the cloud. Signing out will remove them from this browser.",
      ),
    ).toBeDefined();
  });

  it("disables every button while syncing", () => {
    renderDialog({ kind: "syncing", unsyncedCount: 2 });

    const buttons = screen.getAllByRole("button");
    expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(
      true,
    );
    expect(screen.getByRole("status").textContent).toBe("Syncing…");
  });

  it("calls confirm from Sign out anyway", async () => {
    const { user, onConfirm } = renderDialog({
      kind: "confirming",
      unsyncedCount: 1,
    });

    await user.click(screen.getByRole("button", { name: "Sign out anyway" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls cancel on Escape", async () => {
    const { user, onCancel } = renderDialog({
      kind: "confirming",
      unsyncedCount: 1,
    });

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("focuses Cancel when it opens", async () => {
    renderDialog({ kind: "confirming", unsyncedCount: 1 });

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Cancel" }),
      );
    });
  });

  it("stays open and reports progress while signing out", () => {
    renderDialog({ kind: "signing-out" });

    expect(screen.getByRole("status").textContent).toBe("Signing out…");
    expect(
      screen
        .getAllByRole("button")
        .every((button) => button.hasAttribute("disabled")),
    ).toBe(true);
  });

  it("offers a plain sign out when nothing is unsynced", () => {
    renderDialog({ kind: "confirming", unsyncedCount: 0 });

    expect(
      screen.getByText("Every change is saved to the cloud."),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Try to sync" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
  });

  it("explains that the session expired after trying to sync", () => {
    renderDialog({
      kind: "confirming",
      unsyncedCount: 1,
      syncIssue: { kind: "session-expired" },
    });

    expect(screen.getByRole("status").textContent).toBe(
      "Your session expired. Sign in again to sync.",
    );
  });

  it("explains how many schemas conflict with the cloud", () => {
    renderDialog({
      kind: "confirming",
      unsyncedCount: 2,
      syncIssue: { kind: "conflict", count: 2 },
    });

    expect(screen.getByRole("status").textContent).toBe(
      "2 schemas conflict with the cloud. Open them to resolve.",
    );
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the light and dark themes (%s)",
    async (themePreference) => {
      renderDialog({ kind: "confirming", unsyncedCount: 2 }, themePreference);

      await expectNoAxeViolations(
        screen.getByRole("alertdialog", { name: "Sign out?" }),
      );
    },
  );
});
