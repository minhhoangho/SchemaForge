"use client";

import type { JSX, ReactNode } from "react";
import { createContext } from "react";

import type { EditorStore } from "./create-editor-store";

export const EditorStoreContext = createContext<EditorStore | null>(null);

type EditorStoreProviderProps = {
  readonly store: EditorStore;
  readonly children: ReactNode;
};

/**
 * Passes down a store created where the document is known (the editor
 * screen); the provider never creates or replaces the store itself.
 */
export function EditorStoreProvider({
  store,
  children,
}: EditorStoreProviderProps): JSX.Element {
  return <EditorStoreContext value={store}>{children}</EditorStoreContext>;
}
