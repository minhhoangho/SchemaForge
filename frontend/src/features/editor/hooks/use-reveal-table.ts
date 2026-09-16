import type { TableId } from "@schemaforge/core";
import { useCallback } from "react";

import {
  useViewportControls,
  VIEWPORT_TRANSITION_MS,
} from "../lib/viewport-controls";
import { useEditorStoreApi } from "../state/use-editor-store";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Spec section 10: viewport transitions take no time under reduced motion.
function getTransitionDuration(): number {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
    ? 0
    : VIEWPORT_TRANSITION_MS;
}

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
        duration: getTransitionDuration(),
      });
    },
    [store, viewport],
  );
}
