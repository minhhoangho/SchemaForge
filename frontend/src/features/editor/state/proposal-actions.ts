import {
  applyOperation,
  diffSchemas,
  findIntroducedIssues,
  parseOperation,
} from "@schemaforge/core";

import type { Logger } from "@/lib/logger";

import { buildProposalDisplay } from "../lib/proposal-display";
import type {
  EditorActions,
  EditorState,
  EditorStore,
} from "./create-editor-store";

export type ProposalActions = Pick<
  EditorActions,
  "startProposalPreview" | "acceptProposal" | "discardProposal"
>;

export type LockedAction = "dispatch" | "undo" | "redo";

/**
 * Returns whether a preview locks the editor, and logs the call when it does.
 * The interface already blocks every edit during a preview, so a call that
 * gets here is a missed path, not a user action (AI plan, issue 40).
 */
export function isProposalLocked(
  state: EditorState,
  logger: Logger,
  action: LockedAction,
): boolean {
  if (state.proposal === null) {
    return false;
  }
  logger.error("editor.proposal-locked", { action });
  return true;
}

/**
 * Creates the proposal actions of the editor store. A preview never changes
 * the document, the history or the selection; only `acceptProposal` does, and
 * only through `dispatch`, so an accepted proposal is one history entry.
 */
export function createProposalActions(
  set: EditorStore["setState"],
  get: EditorStore["getState"],
): ProposalActions {
  return {
    startProposalPreview: (messageId, operation) => {
      const parsed = parseOperation(operation);
      if (!parsed.isOk) {
        return { isOk: false, error: "invalid" };
      }
      const { document } = get();
      const applied = applyOperation(document, parsed.value);
      if (
        !applied.isOk ||
        findIntroducedIssues(document, applied.value.schema).length > 0
      ) {
        return { isOk: false, error: "stale" };
      }
      const preview = applied.value.schema;
      const diff = diffSchemas(document, preview);
      const { display, marks } = buildProposalDisplay(document, preview, diff);
      set({
        proposal: {
          messageId,
          operation: parsed.value,
          base: document,
          preview,
          diff,
          display,
          marks,
        },
      });
      return { isOk: true, value: undefined };
    },
    acceptProposal: () => {
      const { proposal } = get();
      if (proposal === null) {
        throw new Error("acceptProposal called without a proposal preview");
      }
      set({ proposal: null });
      return get().dispatch(proposal.operation);
    },
    discardProposal: () => {
      set({ proposal: null });
    },
  };
}
