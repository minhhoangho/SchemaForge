"use client";

import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { countProposalChanges } from "../../lib/proposal-display";
import { useAiChatStore } from "../../state/ai-chat-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { AcceptProposalButton } from "./confirm-destructive-proposal-dialog";
import { acceptSafely } from "./proposal-decision";

export type MinimizedProposalActionsProps = {
  // Where focus goes once the buttons leave with the preview.
  readonly onDecided: () => void;
};

/**
 * Accept and Discard of a live preview while the AI window is minimized, so
 * the user can decide while looking at the diff on the canvas. The same
 * actions as the preview bar, including the destructive confirm.
 */
export function MinimizedProposalActions({
  onDecided,
}: MinimizedProposalActionsProps): JSX.Element | null {
  const { t } = useTranslation("ai");
  const titleId = useId();
  const proposal = useEditorStore((state) => state.proposal);
  const acceptProposal = useAiChatStore((state) => state.acceptProposal);
  const discardProposal = useAiChatStore((state) => state.discardProposal);

  if (proposal === null) {
    return null;
  }
  const { messageId } = proposal;
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2"
    >
      <p id={titleId} className="mr-auto text-sm font-semibold">
        {t("proposal.title")}
      </p>
      <AcceptProposalButton
        counts={countProposalChanges(proposal)}
        onAccept={() => {
          acceptSafely(() => {
            acceptProposal(messageId);
          });
          onDecided();
        }}
      />
      <Button
        variant="outline"
        onClick={() => {
          discardProposal(messageId);
          onDecided();
        }}
      >
        {t("proposal.discard")}
      </Button>
    </div>
  );
}
