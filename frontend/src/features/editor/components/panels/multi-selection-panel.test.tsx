import { screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { Selection } from "../../lib/selection";
import { MultiSelectionPanel } from "./multi-selection-panel";

const SELECTION: Selection = {
  tableIds: ["tbl_users", "tbl_orders"],
  relationIds: ["rel_orders_users"],
};

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly onDelete: ReturnType<typeof vi.fn<() => void>>;
};

type HarnessOptions = {
  readonly selection?: Selection;
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

// Deleting itself (one batch, a single undo, the cleared selection) is the
// workspace's delete path, tested with `useDeleteSelection`.
function renderPanel(options: HarnessOptions = {}): Harness {
  const onDelete = vi.fn<() => void>();
  const result = renderWithProviders(
    <MultiSelectionPanel
      selection={options.selection ?? SELECTION}
      onDelete={onDelete}
    />,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
    },
  );
  return { ...result, onDelete };
}

describe("MultiSelectionPanel", () => {
  it("summarises the number of tables and relations", () => {
    renderPanel();

    expect(screen.getByText("Selected 2 tables and 1 relation")).toBeDefined();
  });

  it.each([
    ["en", "Selected 1 table and 1 relation"],
    ["vi", "Đã chọn 1 bảng, 1 quan hệ"],
  ] as const)("uses the singular summary in %s", (locale, summary) => {
    renderPanel({
      locale,
      selection: { tableIds: ["tbl_users"], relationIds: ["rel_orders_users"] },
    });

    expect(screen.getByText(summary)).toBeDefined();
  });

  it("asks to delete the whole selection", async () => {
    const { user, onDelete } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete all" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderPanel({ themePreference });

      await expectNoAxeViolations(container);
    },
  );
});
