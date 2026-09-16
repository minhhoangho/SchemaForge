import { useContext } from "react";
import { useStore } from "zustand";

import type {
  EditorActions,
  EditorState,
  EditorStore,
} from "./create-editor-store";
import { EditorStoreContext } from "./editor-store-provider";

export function useEditorStoreApi(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (store === null) {
    throw new Error(
      "useEditorStore must be used inside an EditorStoreProvider.",
    );
  }
  return store;
}

/**
 * Reads one slice of the editor store and re-renders only when that slice
 * changes. The selector must not build a new object or array on every call,
 * or the component re-renders on every store change (and React warns about an
 * unstable snapshot); to read several values, wrap the selector in
 * `useShallow` from `zustand/react/shallow`.
 */
export function useEditorStore<Slice>(
  selector: (state: EditorState & EditorActions) => Slice,
): Slice {
  return useStore(useEditorStoreApi(), selector);
}
