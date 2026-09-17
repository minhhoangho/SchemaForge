"use client";

import { useCallback, useState } from "react";

import { useEditorStoreApi } from "../state/use-editor-store";
import { useDeleteSelection } from "./use-delete-selection";
import { useEditorShortcuts } from "./use-editor-shortcuts";
import { focusFieldByPath, useFocusRequest } from "./use-focus-request";

export type WorkspaceKeyboard = {
  // Callback ref for the focusable region around the canvas: where focus
  // returns after a delete, and the create relation dialog's fallback (plan
  // issue 73).
  readonly setCanvasRegion: (element: HTMLElement | null) => void;
  readonly deleteSelection: () => void;
};

/**
 * Wires the editor's keyboard and focus handling: undo, redo and Delete
 * shortcuts, the single delete path, and the store's focus requests.
 */
export function useWorkspaceKeyboard(isDialogOpen: boolean): WorkspaceKeyboard {
  const store = useEditorStoreApi();
  const [canvasRegion, setCanvasRegion] = useState<HTMLElement | null>(null);
  const focusCanvas = useCallback(() => {
    canvasRegion?.focus();
  }, [canvasRegion]);
  const deleteSelection = useDeleteSelection(focusCanvas);
  useEditorShortcuts({
    store,
    canvasElement: canvasRegion,
    isDialogOpen,
    platformHint: navigator.platform,
    onDeleteSelection: deleteSelection,
  });
  useFocusRequest(focusFieldByPath);

  return { setCanvasRegion, deleteSelection };
}
