import { useCallback, useEffect, useRef } from "react";

/**
 * Moves focus to an element that exists only after the next render, such as
 * the field of a value just added or the neighbor of a value just removed.
 * The returned function records the element id; the effect runs after the
 * render that the dispatch caused and focuses it, so focus never falls back
 * to the page body when the focused element leaves the DOM.
 */
export function usePendingFocus(): (elementId: string) => void {
  const pendingElementIdRef = useRef<string | null>(null);

  // No dependency list: the pending id may be set by any render's handler.
  useEffect(() => {
    const elementId = pendingElementIdRef.current;
    if (elementId === null) {
      return;
    }
    pendingElementIdRef.current = null;
    window.document.getElementById(elementId)?.focus();
  });

  return useCallback((elementId: string): void => {
    pendingElementIdRef.current = elementId;
  }, []);
}
