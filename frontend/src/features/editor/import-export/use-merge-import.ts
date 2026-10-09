"use client";

import type { BatchOperation, TableId } from "@schemaforge/core";
import { useCallback } from "react";

import type { ImportConfirmation } from "@/components/import-dialog/import-dialog";
import { useNotify } from "@/lib/use-notify";

import { useCanvasNodeControls } from "../lib/viewport-controls";
import { selectIsPreviewing } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { useEditorStoreApi } from "../state/use-editor-store";

export type MergeConfirmation = Extract<ImportConfirmation, { mode: "merge" }>;

function collectAddedTableIds(operation: BatchOperation): readonly TableId[] {
  return operation.operations.flatMap((step) =>
    step.type === "addTable" ? [step.table.id] : [],
  );
}

// Undoes the import only while it is still the latest history entry, so the
// toast action never undoes a change made after it (as `useDeleteSelection`).
function createUndoImport(store: EditorStore): () => void {
  const importEntry = store.getState().history.past.at(-1);
  return () => {
    const state = store.getState();
    if (
      importEntry !== undefined &&
      state.history.past.at(-1) === importEntry
    ) {
      state.undo();
    }
  };
}

/**
 * Applies a merge import as one operation through the store's `dispatch`, so
 * core validates it and one undo removes all of it; then selects the new
 * tables and fits the view around them (spec section 2).
 */
export function useMergeImport(): (confirmation: MergeConfirmation) => void {
  const store = useEditorStoreApi();
  const notify = useNotify();
  const { fitNodes } = useCanvasNodeControls();

  return useCallback(
    ({ operation, target }) => {
      const state = store.getState();
      // `dispatch` ignores every operation during a preview (Vấn đề 19).
      if (selectIsPreviewing(state)) {
        notify({
          tone: "error",
          titleKey: "importExport:import.errors.previewing",
        });
        return;
      }
      // Cloud sync may replace the open document while the dialog is open; the
      // batch was built for `target`, so it is not applied to anything else.
      if (state.document !== target) {
        notify({
          tone: "error",
          titleKey: "importExport:import.errors.notApplied",
        });
        return;
      }
      const previousEntry = state.history.past.at(-1);
      // A rejected batch already reported its error and changed nothing.
      if (!state.dispatch(operation).isOk) return;
      // An empty batch records no history entry, so an undo action would undo
      // the user's previous, unrelated edit.
      if (store.getState().history.past.at(-1) === previousEntry) {
        notify({
          tone: "success",
          titleKey: "importExport:import.done",
          values: { count: 0 },
        });
        return;
      }
      const tableIds = collectAddedTableIds(operation);
      state.setSelection({ tableIds, relationIds: [] });
      fitNodes(tableIds);
      notify({
        tone: "success",
        titleKey: "importExport:import.done",
        values: { count: tableIds.length },
        action: {
          labelKey: "common:actions.undo",
          onSelect: createUndoImport(store),
        },
      });
    },
    [store, notify, fitNodes],
  );
}
