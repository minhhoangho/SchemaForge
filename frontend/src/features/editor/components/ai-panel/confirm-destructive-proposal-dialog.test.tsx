import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProposalChangeCounts } from "@/features/editor/lib/proposal-display";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AcceptProposalButton } from "./confirm-destructive-proposal-dialog";

const NO_CHANGES: ProposalChangeCounts = {
  addedTables: 0,
  addedColumns: 0,
  changedTables: 0,
  changedColumns: 0,
  removedTables: 0,
  removedColumns: 0,
  cascadeRelations: 0,
  retypedColumns: 0,
};

function renderButton(
  counts: Partial<ProposalChangeCounts>,
  themePreference: "light" | "dark" = "light",
): {
  readonly onAccept: ReturnType<typeof vi.fn<() => void>>;
  readonly rendered: ReturnType<typeof renderWithProviders>;
} {
  const onAccept = vi.fn<() => void>();
  const rendered = renderWithProviders(
    <AcceptProposalButton
      counts={{ ...NO_CHANGES, ...counts }}
      onAccept={onAccept}
    />,
    { locale: "en", themePreference },
  );
  return { onAccept, rendered };
}

describe("AcceptProposalButton", () => {
  it("accepts at once when nothing is removed", async () => {
    const { onAccept, rendered } = renderButton({ addedTables: 2 });

    await rendered.user.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it.each([
    [
      { removedTables: 2, removedColumns: 1 },
      "Accepting this proposal deletes 2 tables and 1 column.",
    ],
    [
      { removedTables: 1 },
      "Accepting this proposal deletes 1 table. You can undo it afterwards.",
    ],
    [
      { removedColumns: 3 },
      "Accepting this proposal deletes 3 columns. You can undo it afterwards.",
    ],
  ])(
    "asks for confirmation before accepting a proposal that removes %j",
    async (counts, message) => {
      const { onAccept, rendered } = renderButton(counts);

      await rendered.user.click(screen.getByRole("button", { name: "Accept" }));

      expect(onAccept).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog").textContent).toContain(message);
      expect(screen.getByRole("alertdialog").textContent).not.toContain("0 ");
    },
  );

  it("focuses the cancel button when the confirmation opens", async () => {
    const { rendered } = renderButton({ removedColumns: 3 });

    await rendered.user.click(screen.getByRole("button", { name: "Accept" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });

  it("accepts only from the confirm button", async () => {
    const { onAccept, rendered } = renderButton({ removedColumns: 1 });

    await rendered.user.click(screen.getByRole("button", { name: "Accept" }));
    await rendered.user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await rendered.user.click(screen.getByRole("button", { name: "Accept" }));
    await rendered.user.click(
      screen.getByRole("button", { name: "Accept and delete" }),
    );
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations with the dialog open (%s)",
    async (themePreference) => {
      const { rendered } = renderButton({ removedTables: 1 }, themePreference);
      await rendered.user.click(screen.getByRole("button", { name: "Accept" }));

      await expectNoAxeViolations(document.body);
    },
  );
});
