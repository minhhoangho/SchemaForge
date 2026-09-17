"use client";

import type { DocumentPath } from "@schemaforge/core";
import { useEffect } from "react";

import { useEditorStore } from "../state/use-editor-store";

const FOCUS_PATH_SELECTOR = "[data-focus-path]";

/**
 * Focuses the field whose `data-focus-path` is the JSON of `path` (plan issue
 * 64). Matching on dataset avoids building a selector from user-chosen ids. No
 * match, for example inside column details the user closed, does nothing.
 */
export function focusFieldByPath(path: DocumentPath): void {
  const focusPath = JSON.stringify(path);
  const field = [
    ...document.querySelectorAll<HTMLElement>(FOCUS_PATH_SELECTOR),
  ].find((element) => element.dataset.focusPath === focusPath);
  field?.focus();
}

/**
 * Hands each focus request of the store to `onFocus`, once the panels showing
 * the requested element have rendered, then clears the request.
 */
export function useFocusRequest(onFocus: (path: DocumentPath) => void): void {
  const focusRequest = useEditorStore((state) => state.focusRequest);
  const requestFocus = useEditorStore((state) => state.requestFocus);

  useEffect(() => {
    if (focusRequest === null) {
      return;
    }
    onFocus(focusRequest);
    requestFocus(null);
  }, [focusRequest, onFocus, requestFocus]);
}
