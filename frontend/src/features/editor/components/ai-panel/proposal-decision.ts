import { logger } from "@/lib/logger";

import { aiProposalCardId } from "./ai-proposal-card";
import { AI_LAUNCHER_ID, AI_RESTORE_ID } from "./ai-panel-ids";

/**
 * Accept and Discard remove the buttons they were pressed on (and the Accept
 * dialog's trigger), so focus goes to the proposal's card (AI-R34), or to the
 * AI launcher when the card cannot take it: the window is closed, or
 * minimized with the card in a hidden part. On a narrow screen the launcher
 * is not rendered while the window is open, so the Restore button is the
 * last fallback (WCAG 2.4.3). It moves a task later: the
 * confirm dialog's focus trap would pull it back while the dialog is still
 * mounted, and the dialog's component offers no `onCloseAutoFocus`.
 */
export function focusProposalCard(messageId: string): void {
  window.setTimeout(() => {
    const card = document.getElementById(aiProposalCardId(messageId));
    const isCardShown = card !== null && card.closest("[hidden]") === null;
    const target = isCardShown
      ? card
      : (document.getElementById(AI_LAUNCHER_ID) ??
        document.getElementById(AI_RESTORE_ID));
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
