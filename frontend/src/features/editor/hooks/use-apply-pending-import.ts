"use client";

import { useEffect } from "react";

import { usePendingImport } from "@/components/pending-import-provider";

import { selectIsPreviewing } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";

/**
 * Applies the import the schema list left for this schema, as one `dispatch`
 * (one undo step, autosaved like any edit). Taking the entry and dispatching
 * wait for a microtask that the effect cleanup cancels: StrictMode's
 * synchronous unmount and remount leaves one live pass, which runs after the
 * autosave and the cloud pusher have subscribed, whatever the hook order.
 */
export function useApplyPendingImport(store: EditorStore): void {
  const { takePendingImport } = usePendingImport();

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) {
        return;
      }
      const state = store.getState();
      // A preview would swallow the dispatch; the entry stays and is only
      // applied on the next mount of this schema's editor.
      if (selectIsPreviewing(state)) {
        return;
      }
      const operation = takePendingImport(state.schemaId);
      if (operation !== null) {
        state.dispatch(operation);
      }
    });
    return () => {
      isActive = false;
    };
  }, [store, takePendingImport]);
}
