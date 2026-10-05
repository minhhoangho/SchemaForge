import type { DocumentPath } from "@schemaforge/core";

import { resolveIssueTarget } from "@/lib/schema/resolve-issue-target";
import { useEditorStoreApi } from "../state/use-editor-store";
import { useRevealTable } from "./use-reveal-table";

function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string | null,
): Value | undefined {
  return elementId === null ? undefined : elements[elementId];
}

export type UseGoToIssueOptions = {
  // The properties panel has the field to focus; the code panel replaces it,
  // so a request there would linger until the panel comes back.
  readonly shouldRequestFocus: boolean;
};

/**
 * Brings the element a path points at into view (spec section 4): a table, or
 * the table of a column or index, is selected and centered; a relation is
 * selected; an enum opens its tab. The field is then asked to take focus when
 * `shouldRequestFocus` is set.
 */
export function useGoToIssue({
  shouldRequestFocus,
}: UseGoToIssueOptions): (issue: { readonly path: DocumentPath }) => void {
  const store = useEditorStoreApi();
  const revealTable = useRevealTable();

  return ({ path }): void => {
    const state = store.getState();
    const target = resolveIssueTarget(state.document, path);
    const relation =
      target.kind === "relation"
        ? lookup(state.document.relations, target.elementId)
        : undefined;
    if (relation !== undefined) {
      state.setSelection({ tableIds: [], relationIds: [relation.id] });
    } else if (target.kind === "enum") {
      state.setLeftPanelTab("enums");
    } else if (target.tableId !== null) {
      revealTable(target.tableId);
    }
    if (shouldRequestFocus) {
      state.requestFocus(path);
    }
  };
}
