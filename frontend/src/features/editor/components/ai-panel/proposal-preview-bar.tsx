"use client";

import type { JSX } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

import { countProposalChanges } from "../../lib/proposal-display";
import type { ProposalPreview } from "../../state/create-editor-store";
import {
  getViewportTransitionDuration,
  useViewportControls,
} from "../../lib/viewport-controls";
import { useAiChatStore } from "../../state/ai-chat-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { buildCountLines } from "./ai-proposal-card";
import { AcceptProposalButton } from "./confirm-destructive-proposal-dialog";
import { acceptSafely, focusProposalCard } from "./proposal-decision";

/**
 * Brings the first added, otherwise changed, table into view when a preview
 * starts (AI-R34). An added table exists only in the preview, so this reads
 * the display document instead of using useRevealTable, which looks in the
 * document and also changes the selection that a preview must keep.
 */
function useRevealPreview(proposal: ProposalPreview): void {
  const viewport = useViewportControls();
  const { messageId, diff, display } = proposal;
  // A column change leaves its table out of diff.tables, so its table counts
  // as changed too.
  const columnId = diff.columns.added[0] ?? diff.columns.changed[0];
  const tableId =
    diff.tables.added[0] ??
    diff.tables.changed[0] ??
    (columnId === undefined ? undefined : display.columns[columnId]?.tableId);
  const position =
    tableId === undefined ? undefined : display.tables[tableId]?.position;
  const x = position?.x;
  const y = position?.y;

  useEffect(() => {
    if (x === undefined || y === undefined) {
      return;
    }
    viewport.setCenter(x, y, {
      zoom: viewport.getZoom(),
      duration: getViewportTransitionDuration(),
    });
    // Once per proposal: a new message id is a new preview.
  }, [messageId, viewport, x, y]);
}

function PreviewBarContent({
  proposal,
}: {
  readonly proposal: ProposalPreview;
}): JSX.Element {
  const { t } = useTranslation("ai");
  const acceptProposal = useAiChatStore((state) => state.acceptProposal);
  const discardProposal = useAiChatStore((state) => state.discardProposal);
  const counts = countProposalChanges(proposal);
  const { messageId } = proposal;
  useRevealPreview(proposal);

  return (
    <div
      role="region"
      aria-label={t("proposal.previewBar.label")}
      // Above the canvas in the normal flow, so it covers neither canvas
      // content nor a panel (WCAG 2.4.11).
      className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background px-3 py-2 text-sm"
    >
      <p className="font-medium">{t("proposal.previewBar.title")}</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {buildCountLines(counts, t).map((line) => (
          <li
            key={line.text}
            className={cn(
              line.isDestructive
                ? "border-l-2 border-diff-removed pl-2 font-bold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {line.text}
          </li>
        ))}
      </ul>
      <div className="ml-auto flex gap-2">
        <AcceptProposalButton
          counts={counts}
          onAccept={() => {
            acceptSafely(() => {
              acceptProposal(messageId);
            });
            focusProposalCard(messageId);
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            discardProposal(messageId);
            focusProposalCard(messageId);
          }}
        >
          {t("proposal.discard")}
        </Button>
      </div>
    </div>
  );
}

/** The bar over the canvas while an AI proposal is previewed (AI-R34). */
export function ProposalPreviewBar(): JSX.Element | null {
  const proposal = useEditorStore((state) => state.proposal);
  return proposal === null ? null : <PreviewBarContent proposal={proposal} />;
}
