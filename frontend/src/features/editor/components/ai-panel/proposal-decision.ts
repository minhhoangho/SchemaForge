import { logger } from "@/lib/logger";

import { aiProposalCardId } from "./ai-proposal-card";
import { AI_PANEL_TOGGLE_ID } from "./ai-panel-ids";

/**
 * Accept and Discard remove the buttons they were pressed on (and the Accept
 * dialog's trigger), so focus goes to the proposal's card (AI-R34), or to the
 * AI toggle when the panel is closed and the bar was used. It moves a task
 * later: the confirm dialog's focus trap would pull it back while the dialog
 * is still mounted, and the dialog's component offers no `onCloseAutoFocus`.
 */
export function focusProposalCard(messageId: string): void {
  window.setTimeout(() => {
    const target =
      document.getElementById(aiProposalCardId(messageId)) ??
      document.getElementById(AI_PANEL_TOGGLE_ID);
    target?.focus();
  }, 0);
}

/**
 * Runs an accept from the card or the bar. The store throws on a programming
 * error (no preview for this message); the click then changes nothing and
 * only the error name is logged.
 */
export function acceptSafely(accept: () => void): void {
  try {
    accept();
  } catch (error: unknown) {
    logger.error("ai.proposal-accept-failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}
