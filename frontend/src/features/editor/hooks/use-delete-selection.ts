"use client";

import { useCallback } from "react";

import type { NotifyInput } from "@/lib/notify";
import { useNotify } from "@/lib/use-notify";

import { buildDeleteSelectionOperation } from "../lib/build-delete-selection-operation";
import { countSelection, EMPTY_SELECTION } from "../lib/selection";
import type { EditorState, EditorStore } from "../state/create-editor-store";
import { useEditorStoreApi } from "../state/use-editor-store";

type DeletedMessage = Pick<NotifyInput, "titleKey" | "values">;

// One table is named; anything else is counted (spec section 3).
function describeDeletion({
  selection,
  document,
}: EditorState): DeletedMessage {
  const [tableId] = selection.tableIds;
  const isSingleTable =
    selection.tableIds.length === 1 && selection.relationIds.length === 0;
  const table = tableId === undefined ? undefined : document.tables[tableId];
  if (isSingleTable && table !== undefined) {
    return {
      titleKey: "editor:layout.deleted.one",
      values: { name: table.name },
    };
  }
  return {
    titleKey: "editor:layout.deleted.many",
    values: { count: countSelection(selection) },
  };
}

/**
 * Undoes the deletion only while it is still the latest history entry, so the
 * toast action never undoes a change made after it.
 */
function createUndoDeletion(store: EditorStore): () => void {
  const deletionEntry = store.getState().history.past.at(-1);
  return () => {
    const state = store.getState();
    if (
      deletionEntry !== undefined &&
      state.history.past.at(-1) === deletionEntry
    ) {
      state.undo();
    }
  };
}

/**
 * Deletes the selected tables and relations as one batch (spec section 3),
 * clears the selection, moves focus back to the canvas, and offers an undo in
 * a toast. An empty selection does nothing.
 */
export function useDeleteSelection(focusCanvas: () => void): () => void {
  const store = useEditorStoreApi();
  const notify = useNotify();

  return useCallback(() => {
    const state = store.getState();
    const operation = buildDeleteSelectionOperation(state.selection);
    // A rejected batch already reported its error and changed nothing.
    if (operation === null || !state.dispatch(operation).isOk) {
      return;
    }
    const message = describeDeletion(state);
    state.setSelection(EMPTY_SELECTION);
    focusCanvas();
    notify({
      tone: "success",
      ...message,
      action: {
        labelKey: "common:actions.undo",
        onSelect: createUndoDeletion(store),
      },
    });
  }, [store, notify, focusCanvas]);
}
