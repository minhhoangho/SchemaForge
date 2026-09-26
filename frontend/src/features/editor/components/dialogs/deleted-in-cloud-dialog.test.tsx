import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { DeletedInCloudDialog } from "./deleted-in-cloud-dialog";

type Handlers = {
  readonly recreateInCloud: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly removeFromBrowser: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

function renderDialog(
  themePreference: "light" | "dark" = "light",
): Handlers & ReturnType<typeof renderWithProviders> {
  const handlers: Handlers = {
    recreateInCloud: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    removeFromBrowser: vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const rendered = renderWithProviders(
    <DeletedInCloudDialog
      open
      resolution={{ isBusy: false, ...handlers }}
      onClose={vi.fn<() => void>()}
      onReturnFocus={vi.fn<() => void>()}
    />,
    { locale: "en", themePreference },
  );
  return { ...handlers, ...rendered };
}

describe("DeletedInCloudDialog", () => {
  it("calls recreateInCloud from Recreate in the cloud", async () => {
    const { user, recreateInCloud } = renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Recreate in the cloud" }),
    );

    expect(recreateInCloud).toHaveBeenCalledOnce();
  });

  it("calls removeFromBrowser from Remove from this browser", async () => {
    const { user, removeFromBrowser } = renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Remove from this browser" }),
    );

    expect(removeFromBrowser).toHaveBeenCalledOnce();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the light and dark themes (%s)",
    async (themePreference) => {
      renderDialog(themePreference);

      await expectNoAxeViolations(
        screen.getByRole("alertdialog", {
          name: "This schema was deleted in the cloud",
        }),
      );
    },
  );
});
