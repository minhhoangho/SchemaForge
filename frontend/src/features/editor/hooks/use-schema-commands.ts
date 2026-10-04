import type { Position } from "@schemaforge/core";
import { useCallback, useMemo } from "react";

import { buildAddEnumOperation } from "../lib/build-add-enum-operation";
import {
  buildAddTableOperation,
  findFreeTablePosition,
} from "../lib/build-add-table-operation";
import {
  getViewportTransitionDuration,
  useViewportControls,
} from "../lib/viewport-controls";
import { selectIsPreviewing } from "../state/create-editor-store";
import { useEditorStoreApi } from "../state/use-editor-store";

export type SchemaCommands = {
  readonly addTable: () => void;
  readonly addEnum: () => void;
};

// `ViewportControls` cannot tell where the viewport currently is, so a new
// table starts at the canvas origin; `buildAddTableOperation` steps it aside
// when another table already sits there, and the viewport then moves to it.
const NEW_TABLE_ORIGIN: Position = { x: 0, y: 0 };

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * The "add table" and "add enum" commands shared by the toolbar, the left
 * panel and the canvas. Each reads the document when it runs, so the hook
 * never subscribes to it, and the returned object stays the same across
 * renders for components that must not re-render.
 */
export function useSchemaCommands(): SchemaCommands {
  const store = useEditorStoreApi();
  const viewport = useViewportControls();

  const addTable = useCallback((): void => {
    const state = store.getState();
    // A preview locks every edit path, whichever button calls this (AI-R34).
    if (selectIsPreviewing(state)) {
      return;
    }
    // The same position the builder gives the new table.
    const position = findFreeTablePosition(state.document, NEW_TABLE_ORIGIN);
    const { operation, tableId } = buildAddTableOperation(state.document, {
      position,
      generateId,
    });
    if (!state.dispatch(operation).isOk) {
      return;
    }
    state.setSelection({ tableIds: [tableId], relationIds: [] });
    state.requestFocus(["tables", tableId, "name"]);
    viewport.setCenter(position.x, position.y, {
      zoom: viewport.getZoom(),
      duration: getViewportTransitionDuration(),
    });
  }, [store, viewport]);

  const addEnum = useCallback((): void => {
    const state = store.getState();
    if (selectIsPreviewing(state)) {
      return;
    }
    const { operation, enumId } = buildAddEnumOperation(
      state.document,
      generateId,
    );
    if (!state.dispatch(operation).isOk) {
      return;
    }
    state.setLeftPanelTab("enums");
    state.requestFocus(["enums", enumId, "name"]);
  }, [store]);

  return useMemo(() => ({ addTable, addEnum }), [addTable, addEnum]);
}
