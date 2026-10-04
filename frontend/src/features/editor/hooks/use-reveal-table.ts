import type { TableId } from "@schemaforge/core";
import { useCallback } from "react";

import {
  getViewportTransitionDuration,
  useViewportControls,
} from "../lib/viewport-controls";
import { useEditorStoreApi } from "../state/use-editor-store";

/**
 * Selects a table and brings it to the middle of the viewport at the current
 * zoom: the click alternative to panning the canvas (WCAG 2.5.7). Reads the
 * document when called, so the hook never subscribes to it.
 */
export function useRevealTable(): (tableId: TableId) => void {
  const store = useEditorStoreApi();
  const viewport = useViewportControls();

  return useCallback(
    (tableId: TableId): void => {
      const state = store.getState();
      const table = state.document.tables[tableId];
      if (table === undefined) {
        return;
      }
      state.setSelection({ tableIds: [table.id], relationIds: [] });
      viewport.setCenter(table.position.x, table.position.y, {
        zoom: viewport.getZoom(),
        duration: getViewportTransitionDuration(),
      });
    },
    [store, viewport],
  );
}
