"use client";

import { useEffect, useRef } from "react";

import {
  getShortcutPlatform,
  matchShortcut,
  shouldHandleShortcut,
} from "../lib/should-handle-shortcut";
import type { EditorStore } from "../state/create-editor-store";

export type UseEditorShortcutsInput = {
  readonly store: EditorStore;
  readonly canvasElement: Element | null;
  readonly isDialogOpen: boolean;
  /**
   * Usually `navigator.platform`: deprecated but typed and present in every
   * supported browser, unlike `navigator.userAgentData`.
   */
  readonly platformHint: string;
  readonly onDeleteSelection: () => void;
};

type LatestShortcutInput = Pick<
  UseEditorShortcutsInput,
  "canvasElement" | "isDialogOpen" | "onDeleteSelection"
>;

/**
 * Turns `keydown` on the window into undo, redo and delete-selection. The
 * listener is attached once per store and platform; the values that change
 * between renders are read from a ref so the handler always sees the latest.
 */
export function useEditorShortcuts({
  store,
  canvasElement,
  isDialogOpen,
  platformHint,
  onDeleteSelection,
}: UseEditorShortcutsInput): void {
  const latestRef = useRef<LatestShortcutInput>({
    canvasElement,
    isDialogOpen,
    onDeleteSelection,
  });
  latestRef.current = { canvasElement, isDialogOpen, onDeleteSelection };

  useEffect(() => {
    const platform = getShortcutPlatform(platformHint);

    function handleKeyDown(event: KeyboardEvent): void {
      const action = matchShortcut(event, platform);
      if (action === null) {
        return;
      }
      const latest = latestRef.current;
      const isHandled = shouldHandleShortcut(event, {
        shouldRequireCanvasFocus: action === "deleteSelection",
        isDialogOpen: latest.isDialogOpen,
        canvasElement: latest.canvasElement,
      });
      if (!isHandled) {
        return;
      }

      event.preventDefault();
      if (action === "undo") {
        store.getState().undo();
      } else if (action === "redo") {
        store.getState().redo();
      } else {
        latest.onDeleteSelection();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [store, platformHint]);
}
