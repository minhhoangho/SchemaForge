import type { RefObject } from "react";
import { useEffect, useRef } from "react";

/**
 * The AI window's body mounts once, so its own effects focus it on the first
 * open only. Opening again while the window is still animating out reuses
 * it: focus moves to the composer then, or the body's first link or button.
 */
export function useFocusBodyOnReopen(
  isOpen: boolean,
  bodyRef: RefObject<HTMLDivElement | null>,
): void {
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    const isReopened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    const body = bodyRef.current;
    if (!isReopened || body === null) {
      return;
    }
    const target =
      body.querySelector("textarea") ??
      body.querySelector<HTMLElement>("a[href], button:not(:disabled)");
    target?.focus();
  }, [isOpen, bodyRef]);
}
