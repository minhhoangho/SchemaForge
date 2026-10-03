import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProposalChangeCounts } from "@/features/editor/lib/proposal-display";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AiProposalCard, aiProposalCardId } from "./ai-proposal-card";
import type {
  AiProposalCardProps,
  ProposalCardStatus,
} from "./ai-proposal-card";

const COUNTS: ProposalChangeCounts = {
  addedTables: 2,
  addedColumns: 5,
  changedTables: 0,
  changedColumns: 1,
  removedTables: 0,
  removedColumns: 0,
  cascadeRelations: 0,
  retypedColumns: 0,
};

type Handlers = Pick<AiProposalCardProps, "onAccept" | "onDiscard" | "onRetry">;

function renderCard(
  props: Partial<AiProposalCardProps> = {},
): Handlers & ReturnType<typeof renderWithProviders> {
  const handlers: Handlers = {
    onAccept: vi.fn<() => void>(),
    onDiscard: vi.fn<() => void>(),
    onRetry: vi.fn<() => void>(),
  };
  const rendered = renderWithProviders(
    <AiProposalCard
      messageId="m1"
      status="preview"
      hasStoppedEarly={false}
      counts={COUNTS}
      {...handlers}
      {...props}
    />,
    { locale: "en" },
  );
  return { ...handlers, ...rendered };
}

describe("AiProposalCard", () => {
  it("is a focusable labelled group with a stable id", () => {
    renderCard();

    const card = screen.getByRole("group", { name: "Proposed changes" });
    expect(card.getAttribute("id")).toBe(aiProposalCardId("m1"));
    expect(card.getAttribute("tabindex")).toBe("-1");
  });

  it("shows the added, changed and removed counts", () => {
    renderCard({ counts: { ...COUNTS, removedTables: 1 } });

    const card = screen.getByRole("group", { name: "Proposed changes" });
    expect(within(card).getByText("2 tables added")).toBeTruthy();
    expect(within(card).getByText("5 columns added")).toBeTruthy();
    expect(within(card).getByText("1 column changed")).toBeTruthy();
    expect(within(card).getByText("1 table removed")).toBeTruthy();
    expect(within(card).queryByText(/tables changed/)).toBeNull();
  });

  it("emphasizes destructive counts with bold text, not only color", () => {
    renderCard({ counts: { ...COUNTS, removedColumns: 2, retypedColumns: 1 } });

    expect(
      screen.getByText("2 columns removed").classList.contains("font-bold"),
    ).toBe(true);
    expect(
      screen.getByText("1 column changes type").classList.contains("font-bold"),
    ).toBe(true);
    expect(
      screen.getByText("2 tables added").classList.contains("font-bold"),
    ).toBe(false);
  });

  it("discards from the discard button", async () => {
    const { user, onDiscard, onAccept } = renderCard();

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it.each([
    [
      "stale",
      "This proposal no longer applies because the schema has changed.",
    ],
    ["invalid", "This proposal is not valid and cannot be applied."],
  ] as const)("shows %s with a retry button", async (status, message) => {
    const { user, onRetry } = renderCard({ status, counts: null });

    expect(screen.getByText(message)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("shows the stopped early note", () => {
    renderCard({ hasStoppedEarly: true });

    expect(
      screen.getByText("The assistant stopped before finishing this proposal."),
    ).toBeTruthy();
  });

  it.each([
    ["accepted", "Accepted"],
    ["discarded", "Discarded"],
  ] as const)("shows %s without action buttons", (status, label) => {
    renderCard({ status, counts: null });

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    "preview",
    "accepted",
    "discarded",
    "stale",
    "invalid",
  ] satisfies readonly ProposalCardStatus[])(
    "has no axe violations (%s)",
    async (status) => {
      const { container } = renderCard({
        status,
        counts: status === "preview" ? COUNTS : null,
      });

      await expectNoAxeViolations(container);
    },
  );

  it("can be used with the keyboard only", async () => {
    const { user, onAccept } = renderCard();

    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Accept" }),
    );
    await user.keyboard("{Enter}");

    expect(onAccept).toHaveBeenCalledOnce();
  });
});
